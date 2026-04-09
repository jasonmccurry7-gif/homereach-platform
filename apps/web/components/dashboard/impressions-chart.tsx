"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Impressions Chart
// Pure SVG bar chart — zero dependencies.
// Shows cumulative homes reached per drop over time.
// ─────────────────────────────────────────────────────────────────────────────

interface DropBar {
  label: string;       // e.g. "Jan", "Feb"
  impressions: number;
  isProjected?: boolean;
}

interface ImpressionsChartProps {
  drops: DropBar[];
  homesPerDrop: number;
}

export function ImpressionsChart({ drops, homesPerDrop }: ImpressionsChartProps) {
  const maxVal = Math.max(...drops.map((d) => d.impressions), homesPerDrop);
  const barW = 32;
  const barGap = 16;
  const chartH = 120;
  const chartW = drops.length * (barW + barGap);
  const labelH = 24;

  return (
    <div className="overflow-x-auto">
      <svg
        width={Math.max(chartW, 200)}
        height={chartH + labelH}
        className="block"
        aria-label="Monthly impressions chart"
      >
        {/* Gridlines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => {
          const y = chartH - chartH * pct;
          return (
            <line
              key={pct}
              x1={0}
              y1={y}
              x2={chartW}
              y2={y}
              stroke="#f3f4f6"
              strokeWidth={1}
            />
          );
        })}

        {/* Bars */}
        {drops.map((drop, i) => {
          const barH = Math.max(4, (drop.impressions / maxVal) * chartH);
          const x = i * (barW + barGap);
          const y = chartH - barH;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={5}
                className={
                  drop.isProjected
                    ? "fill-blue-100"
                    : "fill-blue-500"
                }
              />
              {/* Value label on top */}
              {!drop.isProjected && drop.impressions > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-gray-500 font-medium"
                >
                  {drop.impressions >= 1000
                    ? `${(drop.impressions / 1000).toFixed(1)}k`
                    : drop.impressions}
                </text>
              )}
              {drop.isProjected && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-blue-300"
                >
                  est.
                </text>
              )}
              {/* Month label */}
              <text
                x={x + barW / 2}
                y={chartH + labelH - 6}
                textAnchor="middle"
                fontSize={10}
                className="fill-gray-400"
              >
                {drop.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
