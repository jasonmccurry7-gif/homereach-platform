"use client";

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Bar Component
// Shows the pipeline stage for a single lead as a horizontal progress bar.
// Stages: new → queued → contacted → replied → interested → payment_sent → closed
// ─────────────────────────────────────────────────────────────────────────────

interface PipelineBarProps {
  status: string;
  className?: string;
}

const PIPELINE_STAGES = [
  { key: "new", label: "New", order: 0 },
  { key: "queued", label: "Queued", order: 1 },
  { key: "contacted", label: "Contacted", order: 2 },
  { key: "replied", label: "Replied", order: 3 },
  { key: "interested", label: "Interested", order: 4 },
  { key: "payment_sent", label: "Payment Sent", order: 5 },
  { key: "closed", label: "Closed", order: 6 },
];

const DEAD_STAGE = { key: "dead", label: "Lost", order: -1 };

function getStageIndex(status: string): number {
  if (status === "dead") return -1;
  const stage = PIPELINE_STAGES.find((s) => s.key === status);
  return stage ? stage.order : 0;
}

function getAllStages(status: string): typeof PIPELINE_STAGES {
  if (status === "dead") return [DEAD_STAGE];
  return PIPELINE_STAGES;
}

export default function PipelineBar({ status, className = "" }: PipelineBarProps) {
  const stageIndex = getStageIndex(status);
  const stages = getAllStages(status);
  const isDead = status === "dead";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Pipeline circles and connectors */}
      <div className="flex items-center gap-0">
        {stages.map((stage, idx) => {
          const isCurrent = stage.order === stageIndex;
          const isCompleted = stage.order < stageIndex && !isDead;
          const isLost = isDead;

          return (
            <div key={stage.key} className="flex items-center">
              {/* Circle */}
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                  text-xs font-bold transition-all
                  ${
                    isLost
                      ? "bg-red-600 border border-red-700"
                      : isCurrent
                        ? "bg-green-500 border border-green-600 ring-2 ring-green-400 animate-pulse"
                        : isCompleted
                          ? "bg-blue-600 border border-blue-700"
                          : "bg-gray-700 border border-gray-600"
                  }
                `}
              >
                {isLost && <span className="text-white text-xs">×</span>}
              </div>

              {/* Connector line (except after last stage) */}
              {idx < stages.length - 1 && (
                <div
                  className={`
                    h-0.5 flex-1 mx-1 transition-all
                    ${
                      isCompleted
                        ? "bg-blue-600"
                        : isCurrent || isLost
                          ? "bg-gray-500"
                          : "bg-gray-700"
                    }
                  `}
                  style={{ minWidth: "16px" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels (hidden on mobile for stages < 3) */}
      <div className="flex items-center gap-0 text-xs">
        {stages.map((stage, idx) => {
          const isCurrent = stage.order === stageIndex;
          const isLost = isDead;

          const shouldHideOnMobile = stage.order < 3;

          return (
            <div key={`label-${stage.key}`} className="flex items-center">
              {/* Label */}
              <div
                className={`
                  flex-shrink-0 text-center transition-all
                  ${shouldHideOnMobile ? "hidden sm:block" : "block"}
                  ${
                    isLost
                      ? "text-red-400 font-bold"
                      : isCurrent
                        ? "text-green-400 font-bold"
                        : "text-gray-400"
                  }
                `}
                style={{ width: "20px" }}
              >
                {isLost ? "Lost" : ""}
              </div>

              {/* Spacing */}
              {idx < stages.length - 1 && <div style={{ minWidth: "16px" }} />}
            </div>
          );
        })}
      </div>

      {/* Stage name below the bar (responsive) */}
      <div className="text-xs text-gray-400 font-medium mt-1">
        {isDead ? "Lost" : stages[stageIndex]?.label || "Unknown"}
      </div>
    </div>
  );
}
