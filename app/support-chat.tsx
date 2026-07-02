"use client";

import { Bot, MessageCircle, Send, X } from "lucide-react";
import { FormEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I can answer quick questions about Secret Mouse Tickets, what access includes, and how the Disney discount link works.",
  },
];

const suggestions = [
  "What am I buying?",
  "Are you affiliated with Disney?",
  "How do I check my dates?",
];

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");

  async function submitMessage(event?: FormEvent<HTMLFormElement>, override?: string) {
    event?.preventDefault();

    const content = (override ?? draft).trim();
    if (!content || status === "sending") {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setStatus("sending");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            payload.reply ??
            payload.error ??
            "I am having trouble answering right now. The visit-details form still works for checking your dates.",
        },
      ]);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            "I am having trouble answering right now. The visit-details form still works for checking your dates.",
        },
      ]);
    } finally {
      setStatus("idle");
    }
  }

  function submitSuggestion(value: string) {
    setIsOpen(true);
    void submitMessage(undefined, value);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section className="cartoon-panel flex h-[min(620px,calc(100vh-7rem))] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[24px] border-4 border-[#120f17] bg-white shadow-[8px_8px_0_#120f17]">
          <header className="flex items-center justify-between gap-3 border-b-4 border-[#120f17] bg-[#d8c6ff] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#ffbd38]">
                <Bot size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black">Secret Mouse Help</h2>
                <p className="text-xs font-bold text-[#3e304d]">Ticket access questions</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-white"
              aria-label="Close chat"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#fffaf0] px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-[18px] border-[3px] border-[#120f17] px-3 py-2 text-sm font-semibold leading-6 shadow-[3px_3px_0_#120f17] ${
                  message.role === "user"
                    ? "ml-auto bg-[#8f72f2] text-white"
                    : "mr-auto bg-white text-[#3e304d]"
                }`}
              >
                {message.content}
              </div>
            ))}
            {status === "sending" && (
              <div className="mr-auto max-w-[88%] rounded-[18px] border-[3px] border-[#120f17] bg-white px-3 py-2 text-sm font-bold text-[#3e304d] shadow-[3px_3px_0_#120f17]">
                Thinking...
              </div>
            )}
          </div>

          <div className="grid gap-3 border-t-4 border-[#120f17] bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submitSuggestion(suggestion)}
                  disabled={status === "sending"}
                  className="rounded-full border-[3px] border-[#120f17] bg-[#fff7de] px-3 py-1 text-xs font-bold text-[#3e304d] disabled:opacity-60"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form onSubmit={submitMessage} className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={500}
                className="h-11 min-w-0 flex-1 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-sm font-semibold outline-none"
                placeholder="Ask a question..."
              />
              <button
                type="submit"
                disabled={!draft.trim() || status === "sending"}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border-[3px] border-[#120f17] bg-[#ffbd38] disabled:opacity-60"
                aria-label="Send message"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-16 items-center gap-3 rounded-full border-4 border-[#120f17] bg-[#ffbd38] px-5 font-black text-[#120f17] shadow-[6px_6px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#120f17]"
        aria-expanded={isOpen}
      >
        <MessageCircle size={22} aria-hidden="true" />
        <span className="hidden sm:inline">Ask Us</span>
      </button>
    </div>
  );
}
