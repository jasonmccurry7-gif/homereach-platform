"use client";

import { useMemo } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesAtlas from "us-atlas/states-10m.json";
import { eventCentroid, isRecentStormEvent } from "@/lib/stormreach/geo";
import type { StormDashboardEvent } from "@/lib/stormreach/types";

type StormReachMapProps = {
  events: StormDashboardEvent[];
  selectedEventId?: string | null;
  height?: number;
};

export function StormReachMap({ events, height = 460, selectedEventId }: StormReachMapProps) {
  const width = 980;
  const projection = useMemo(() => geoAlbersUsa().translate([width / 2, height / 2]).scale(height * 1.22), [height]);
  const path = useMemo(() => geoPath(projection), [projection]);
  const states = useMemo(() => {
    const atlas = statesAtlas as any;
    return feature(atlas, atlas.objects.states) as unknown as { features: Array<Record<string, unknown>> };
  }, []);

  const markers = events
    .filter((event) => !["archived", "dismissed"].includes(event.status))
    .slice(0, 80)
    .map((event) => {
      const point = eventCentroid(event);
      const projected = point ? projection(point) : null;
      return projected ? { event, x: projected[0], y: projected[1] } : null;
    })
    .filter((marker): marker is { event: StormDashboardEvent; x: number; y: number } => Boolean(marker));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="StormReach national event map" className="block w-full">
        <rect width={width} height={height} fill="#f8fafc" />
        <g>
          {states.features.map((state, index) => (
            <path
              key={index}
              d={path(state as any) ?? undefined}
              fill="#e2e8f0"
              stroke="#ffffff"
              strokeWidth={0.7}
            />
          ))}
        </g>
        <g>
          {markers.map(({ event, x, y }) => {
            const selected = selectedEventId === event.id || selectedEventId === event.event_id;
            const recent = isRecentStormEvent(event, 24);
            const color = severityColor(event.severity_level);
            const radius = selected ? 13 : event.severity_level === "Extreme" ? 11 : event.severity_level === "High" ? 9 : 7;
            return (
              <a key={event.id} href={`/admin/stormreach/${event.id}`} aria-label={`${event.title} ${event.severity_level}`}>
                {recent ? <circle cx={x} cy={y} r={radius + 9} fill="none" stroke="#2563eb" strokeWidth="2.5" opacity="0.8" /> : null}
                <circle cx={x} cy={y} r={radius + 5} fill={color} opacity="0.12" />
                <circle cx={x} cy={y} r={radius} fill={color} stroke="#0f172a" strokeWidth={selected ? 2.5 : 1} />
                <title>{`${event.title} - ${event.severity_level} (${event.severity_score})${recent ? " - last 24 hours" : ""}`}</title>
              </a>
            );
          })}
        </g>
      </svg>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3 text-xs font-bold text-slate-600">
        <Legend color="#64748b" label="Low" />
        <Legend color="#f59e0b" label="Moderate" />
        <Legend color="#ea580c" label="High" />
        <Legend color="#dc2626" label="Extreme" />
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-blue-600" />
          Last 24h
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function severityColor(level: string) {
  if (level === "Extreme") return "#dc2626";
  if (level === "High") return "#ea580c";
  if (level === "Moderate") return "#f59e0b";
  return "#64748b";
}
