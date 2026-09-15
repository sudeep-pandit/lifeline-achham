import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "@lifeline/types";

interface QueryHandler {
  patterns: RegExp[];
  requiredPermission: string;
  run: (organizationId: string, prisma: PrismaService) => Promise<string>;
}

// Section 31: a small, fixed set of READ-ONLY query handlers. There is no
// "write" or "delete" handler in this list, and there never should be -
// that's what makes "AI must NEVER bypass authorization" and "must not
// allow AI to directly approve payments, delete financial records, or
// perform destructive actions" true by construction rather than by
// prompting. Each handler is gated on the specific permission its data
// requires, checked again here even though the route itself requires
// ai_assistant.use - so a user can't get financial figures out of the
// assistant that they couldn't get from the Finance page directly.
function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}
function startOfNextMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function endOfNextMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 2, 1);
}

const HANDLERS: QueryHandler[] = [
  {
    patterns: [/how many members.*(this month|joined)/i, /members.*joined.*month/i],
    requiredPermission: "members.view",
    run: async (organizationId, prisma) => {
      const count = await prisma.member.count({
        where: { organizationId, deletedAt: null, membershipDate: { gte: startOfMonth() } },
      });
      return `${count} member(s) joined this month.`;
    },
  },
  {
    patterns: [/membership income.*(this year|year)/i, /income.*year/i],
    requiredPermission: "finance.income",
    run: async (organizationId, prisma) => {
      const agg = await prisma.income.aggregate({
        where: { organizationId, deletedAt: null, approvedAt: { not: null }, category: { name: "Membership" }, date: { gte: startOfYear() } },
        _sum: { amount: true },
      });
      return `Membership income this year: ${Number(agg._sum.amount ?? 0).toFixed(2)}.`;
    },
  },
  {
    patterns: [/(which|highest).*municipality/i],
    requiredPermission: "members.view",
    run: async (organizationId, prisma) => {
      const members = await prisma.member.findMany({ where: { organizationId, deletedAt: null }, include: { municipality: true } });
      if (members.length === 0) return "There are no members on file yet.";
      const counts = new Map<string, number>();
      for (const m of members) counts.set(m.municipality.name, (counts.get(m.municipality.name) ?? 0) + 1);
      const [name, count] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      return `${name} has the highest number of members (${count}).`;
    },
  },
  {
    patterns: [/income.*(vs|versus).*expense/i],
    requiredPermission: "finance.income",
    run: async (organizationId, prisma) => {
      const [income, expense] = await Promise.all([
        prisma.income.aggregate({ where: { organizationId, deletedAt: null, approvedAt: { not: null }, date: { gte: startOfMonth() } }, _sum: { amount: true } }),
        prisma.expense.aggregate({ where: { organizationId, deletedAt: null, approvedAt: { not: null }, date: { gte: startOfMonth() } }, _sum: { amount: true } }),
      ]);
      const inc = Number(income._sum.amount ?? 0);
      const exp = Number(expense._sum.amount ?? 0);
      return `This month: income ${inc.toFixed(2)}, expenses ${exp.toFixed(2)}, net ${(inc - exp).toFixed(2)}.`;
    },
  },
  {
    patterns: [/summariz.*month.*(membership|activity)/i],
    requiredPermission: "members.view",
    run: async (organizationId, prisma) => {
      const [newMembers, newApplications, approvals] = await Promise.all([
        prisma.member.count({ where: { organizationId, deletedAt: null, membershipDate: { gte: startOfMonth() } } }),
        prisma.membershipApplication.count({ where: { organizationId, createdAt: { gte: startOfMonth() } } }),
        prisma.membershipApplication.count({ where: { organizationId, status: "APPROVED", reviewedAt: { gte: startOfMonth() } } }),
      ]);
      return `This month: ${newApplications} new application(s) submitted, ${approvals} approved, ${newMembers} new member(s) activated.`;
    },
  },
  {
    patterns: [/yearly membership.*expire.*next month/i, /expire.*next month/i],
    requiredPermission: "members.view",
    run: async (organizationId, prisma) => {
      const count = await prisma.member.count({
        where: { organizationId, deletedAt: null, expiresAt: { gte: startOfNextMonth(), lt: endOfNextMonth() } },
      });
      return `${count} yearly membership(s) expire next month.`;
    },
  },
];

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async ask(user: AuthUser, question: string): Promise<{ answer: string; grounded: boolean }> {
    const handler = HANDLERS.find((h) => h.patterns.some((p) => p.test(question)));

    if (!handler) {
      return {
        answer:
          "I can currently answer questions about member counts, membership income, top municipalities, income vs expenses, monthly activity summaries, and upcoming expirations. Try rephrasing, or check the Reports page for anything more specific.",
        grounded: false,
      };
    }

    if (!user.isSuperAdmin && !user.permissions.includes(handler.requiredPermission)) {
      throw new ForbiddenException(
        `You don't have permission to view the data needed to answer that (requires ${handler.requiredPermission}).`,
      );
    }

    const factualAnswer = await handler.run(user.organizationId, this.prisma);
    const polished = await this.tryPolish(question, factualAnswer);
    return { answer: polished ?? factualAnswer, grounded: true };
  }

  // Optional: if AI_API_KEY is configured, ask Claude to phrase the
  // already-computed, already-authorized answer more conversationally.
  // The LLM is given the exact number and told not to alter it - it is
  // never the source of the number itself, only its wording. If the key
  // is absent or the call fails, the plain factual answer is used as-is,
  // never blocking the response.
  private async tryPolish(question: string, factualAnswer: string): Promise<string | null> {
    const apiKey = this.config.get<string>("ai.apiKey");
    if (!apiKey) return null;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.config.get<string>("ai.model") ?? "claude-sonnet-4-6",
          max_tokens: 200,
          system:
            "Rephrase the given factual answer conversationally for an NGO staff dashboard. Do not change, round, or add any numbers or facts - only the wording and tone.",
          messages: [{ role: "user", content: `Question: ${question}\nFactual answer: ${factualAnswer}` }],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.content?.find((b: any) => b.type === "text")?.text;
      return typeof text === "string" ? text : null;
    } catch (err) {
      this.logger.warn(`AI polish pass failed, falling back to factual answer: ${err}`);
      return null;
    }
  }
}
