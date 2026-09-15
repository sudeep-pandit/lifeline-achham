// Development seed data (Section 45). Clearly-labelled sample records only -
// never used against a production database.
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PERMISSIONS, DEFAULT_ROLES, DEFAULT_ROLE_PERMISSIONS } from "@lifeline/config";
import { DISTRICTS, ACHHAM_MUNICIPALITIES } from "./nepal-data.seed";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Lifeline Achham (development data)...");

  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Lifeline Achham",
    },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      district: "Achham",
      email: "info@lifelineachham.org.np",
      currency: "NPR",
    },
  });

  // --- Permission catalogue (idempotent upsert) ---
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { module: perm.module, action: perm.action, description: perm.description },
      create: perm,
    });
  }

  // --- Default roles + their permission grants ---
  const roleRecords: Record<string, { id: string }> = {};
  for (const role of DEFAULT_ROLES) {
    const created = await prisma.role.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: role.slug } },
      update: {},
      create: {
        organizationId: org.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        isSystem: role.isSystem,
      },
    });
    roleRecords[role.slug] = created;

    const grantKeys = DEFAULT_ROLE_PERMISSIONS[role.slug] ?? [];
    const grants = await prisma.permission.findMany({ where: { key: { in: grantKeys as string[] } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    await prisma.rolePermission.createMany({
      data: grants.map((g) => ({ roleId: created.id, permissionId: g.id })),
      skipDuplicates: true,
    });
  }

  // --- Sample users, one per role (Section 45) ---
  const samplePassword = await bcrypt.hash("ChangeMe123!", 12);
  const sampleUsers = [
    { fullName: "[SAMPLE] Super Admin", email: "superadmin@lifelineachham.dev", roleSlug: "super-admin", isSuperAdmin: true },
    { fullName: "[SAMPLE] Admin User", email: "admin@lifelineachham.dev", roleSlug: "admin", isSuperAdmin: false },
    { fullName: "[SAMPLE] Accountant User", email: "accountant@lifelineachham.dev", roleSlug: "accountant", isSuperAdmin: false },
    { fullName: "[SAMPLE] Staff User", email: "staff@lifelineachham.dev", roleSlug: "staff", isSuperAdmin: false },
  ];

  for (const su of sampleUsers) {
    const user = await prisma.user.upsert({
      where: { email: su.email },
      update: {},
      create: {
        organizationId: org.id,
        fullName: su.fullName,
        email: su.email,
        passwordHash: samplePassword,
        isSuperAdmin: su.isSuperAdmin,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleRecords[su.roleSlug].id } },
      update: {},
      create: { userId: user.id, roleId: roleRecords[su.roleSlug].id },
    });
  }

  // --- Numbering engine starting sequences ---
  const sequences = [
    { key: "membership_id", prefix: "LA-LM" },
    { key: "receipt", prefix: "LA-RCP" },
    { key: "certificate", prefix: "LA-CERT" },
    { key: "card", prefix: "LA-CARD" },
    { key: "temporary_registration", prefix: "LA-TMP" },
    { key: "expense", prefix: "LA-EXP" },
    { key: "income", prefix: "LA-INC" },
    { key: "payment", prefix: "LA-PAY" },
    { key: "application", prefix: "LA-APP" },
  ];
  for (const seq of sequences) {
    await prisma.documentSequence.upsert({
      where: { organizationId_key: { organizationId: org.id, key: seq.key } },
      update: {},
      create: { organizationId: org.id, key: seq.key, prefix: seq.prefix },
    });
  }

  // --- Phase 2: Nepal administrative data (Section 8) ---
  for (const [index, name] of DISTRICTS.entries()) {
    await prisma.district.upsert({
      where: { name },
      update: {},
      create: { name, displayOrder: index },
    });
  }

  const achham = await prisma.district.findUniqueOrThrow({ where: { name: "Achham" } });
  for (const m of ACHHAM_MUNICIPALITIES) {
    await prisma.municipality.upsert({
      where: { districtId_name: { districtId: achham.id, name: m.name } },
      update: {},
      create: { districtId: achham.id, name: m.name, type: m.type, wardCount: m.wardCount },
    });
  }

  // --- Phase 2: default membership types (Section 7) ---
  await prisma.membershipType.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Lifetime Membership" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Lifetime Membership",
      description: "One-time payment, no renewal, never expires.",
      price: 5000,
      durationDays: null,
      displayOrder: 0,
    },
  });
  await prisma.membershipType.upsert({
    where: { organizationId_name: { organizationId: org.id, name: "Yearly Membership" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Yearly Membership",
      description: "Renews annually, 365 days from the membership date.",
      price: 1000,
      durationDays: 365,
      displayOrder: 1,
    },
  });

  // --- Finance categories (Sections 18-19) ---
  // "Membership" must exist with exactly this name - PaymentsService looks
  // it up by name when auto-creating income from a verified payment.
  const incomeCategories = ["Membership", "Donation", "Grant", "Program Income", "Other"];
  for (const [i, name] of incomeCategories.entries()) {
    await prisma.incomeCategory.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name, displayOrder: i },
    });
  }

  const expenseCategories = [
    "Office", "Transportation", "Printing", "Stationery", "Salary",
    "Communication", "Program", "Training", "Event", "Other",
  ];
  for (const [i, name] of expenseCategories.entries()) {
    await prisma.expenseCategory.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name, displayOrder: i },
    });
  }

  console.log("Seed complete.");
  console.log("Sample login (dev only): superadmin@lifelineachham.dev / ChangeMe123!");
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
