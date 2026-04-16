"use client";

import React, { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Response Timer Component
// Shows a countdown timer for responding to a lead reply.
// Escalates to admin if 5 minutes elapse.
// ─────────────────────────────────────────────────────────────────────────────

interface ResponseTimerProps {
  replyReceivedAt: string;
  agentId: string;
  leadId: string;
  onEscalate?: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function ResponseTimer({
  replyReceivedAt,
  agentId,
  leadId,
  onEscalate,
}: ResponseTimerProps) {
  const [remaining, setRemaining] = useState(300); // 5 minutes in seconds
  const [state, setState] = useState<"active" | "warning" | "critical" | "overdue">(
    "active"
  );
  const escalatedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const receivedAt = new Date(replyReceivedAt).getTime();
      const elapsedMs = now - receivedAt;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const remainingSeconds = Math.max(0, 300 - elapsedSeconds);

      setRemaining(remainingSeconds);

      // Update state based on remaining time
      if (remainingSeconds === 0) {
        setState("overdue");

        // Escalate once at 0 seconds
        if (!escalatedRef.current) {
          escalatedRef.current = true;

          // Call the alert API
          fetch("/api/admin/sales/alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: agentId,
              lead_id: leadId,
              trigger: "reply",
              business_name: "Lead",
              message_preview: "Awaiting response",
              city: "",
              category: "",
              urgency: "critical",
            }),
          }).catch((err) => console.error("[response-timer] escalation failed:", err));

          // Call the callback if provided
          if (onEscalate) {
            onEscalate();
          }
        }
      } else if (remainingSeconds < 60) {
        setState("critical");
      } else if (remainingSeconds < 180) {
        setState("warning");
      } else {
        setState("active");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [replyReceivedAt, agentId, leadId, onEscalate]);

  // Determine display text and styling
  let displayText = "";
  let displayIcon = "";
  let bgClass = "";
  let textClass = "";
  let blinking = false;

  switch (state) {
    case "active":
      displayText = `⏱ Respond within ${formatTime(remaining)}`;
      displayIcon = "⏱";
      bgClass = "bg-green-900/20 border border-green-700/40";
      textClass = "text-green-300";
      break;

    case "warning":
      displayText = `⚠️ ${formatTime(remaining)} remaining — respond now`;
      displayIcon = "⚠️";
      bgClass = "bg-yellow-900/20 border border-yellow-700/40";
      textClass = "text-yellow-300";
      break;

    case "critical":
      displayText = `🚨 URGENT — respond immediately`;
      displayIcon = "🚨";
      bgClass = "bg-red-900/20 border border-red-700/40";
      textClass = "text-red-300";
      blinking = true;
      break;

    case "overdue":
      displayText = `🚨 OVERDUE — admin notified`;
      displayIcon = "🚨";
      bgClass = "bg-red-900/40 border border-red-700/80";
      textClass = "text-red-200 font-bold";
      blinking = true;
      break;
  }

  return (
    <div
      className={`
        rounded-lg px-4 py-3 font-bold text-sm transition-all
        ${bgClass} ${textClass}
        ${blinking ? "animate-pulse" : ""}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{displayIcon}</span>
        <span>{displayText}</span>
      </div>
    </div>
  );
}
