"use client";

import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../../lib/api-client";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import type { AskAiResponse } from "@lifeline/types";

interface Turn {
  question: string;
  answer: string;
  grounded: boolean;
}

const EXAMPLES = [
  "How many members joined this month?",
  "What was our membership income this year?",
  "Which municipality has the highest number of members?",
  "Show income versus expenses this month",
  "Summarize this month's membership activity",
  "How many yearly memberships expire next month?",
];

// Section 31. This only ever calls a fixed set of read-only, permission-
// checked queries on the backend - there is no path from this page to
// approving a payment, deleting a record, or any other write action.
export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<AskAiResponse>("/ai/ask", { method: "POST", body: JSON.stringify({ question: q }) });
      setTurns((prev) => [...prev, { question: q, answer: result.answer, grounded: result.grounded }]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reach the assistant.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-navy dark:text-paper">AI Assistant</h1>
      <p className="text-sm text-navy-400 dark:text-navy-100">
        Answers only come from your organization's real data, and only for data you're permitted to see.
        It can't approve payments, delete records, or take any other action - it only answers questions.
      </p>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => ask(ex)}
            disabled={loading}
            className="rounded-full border border-navy-100 px-3 py-1 text-xs text-navy-400 hover:border-crimson hover:text-crimson disabled:opacity-50 dark:border-navy-400 dark:text-navy-100"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {turns.map((t, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Card className="ml-auto max-w-lg bg-navy-50 dark:bg-navy-600">
              <p className="text-sm text-navy dark:text-paper">{t.question}</p>
            </Card>
            <Card className="max-w-lg">
              <p className="text-sm text-navy dark:text-paper">{t.answer}</p>
              {!t.grounded && (
                <p className="mt-1 text-xs text-navy-400 dark:text-navy-100">
                  This wasn't matched to a specific data query - try one of the example questions above.
                </p>
              )}
            </Card>
          </div>
        ))}
        {turns.length === 0 && (
          <p className="text-sm text-navy-400 dark:text-navy-100">Ask a question, or try one of the examples above.</p>
        )}
      </div>

      {error && <p className="text-crimson">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input placeholder="Ask about members, income, or activity…" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Button type="submit" disabled={loading}>{loading ? "Thinking…" : "Ask"}</Button>
      </form>
    </div>
  );
}
