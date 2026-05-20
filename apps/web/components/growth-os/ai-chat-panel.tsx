"use client";

import { FormEvent, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AiChatPanel() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setPending(true);
    setError(null);
    setMessage("");
    setMessages((current) => [...current, { role: "user", content: trimmed }]);

    try {
      const response = await fetch("/api/growth-os/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not answer right now");
      }

      const payload = (await response.json()) as { answer: string };
      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.answer },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer right now");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-950 text-white">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            AI Advisor
          </p>
          <h2 className="text-xl font-bold text-gray-950">Ask about growth</h2>
        </div>
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-600">
            Ask what to do next, why a lever was recommended, or how recent wins
            affect the next move.
          </p>
        ) : (
          messages.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={
                item.role === "user"
                  ? "ml-auto max-w-[90%] rounded-lg bg-blue-600 p-3 text-sm text-white"
                  : "max-w-[90%] whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-gray-700 shadow-sm"
              }
            >
              {item.content}
            </div>
          ))
        )}
      </div>

      <form onSubmit={submitMessage} className="mt-4 flex gap-2">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1200}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
          placeholder="What should I do this week?"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
