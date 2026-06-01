"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type { SharedPostcardSnapshot } from "@/lib/spots/shared-postcard";
import { cn } from "@/lib/utils";

export function SharedPostcardVisual({
  snapshot,
}: {
  snapshot: SharedPostcardSnapshot;
}) {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const style = useMemo(
    () =>
      ({
        "--postcard-rotate-x": `${rotation.x}deg`,
        "--postcard-rotate-y": `${rotation.y}deg`,
      }) as CSSProperties,
    [rotation]
  );

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    setRotation({
      x: Number((-y * 8).toFixed(2)),
      y: Number((x * 10).toFixed(2)),
    });
  }

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-xl shadow-slate-950/15">
      <div className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
        <div className="flex flex-col justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
              Live Shared Postcard
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              {snapshot.cityName} {snapshot.sizeLabel} postcard layout
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Every city has 12 assigned advertising spots. Sold and reserved clients are shown in their current city layout; open cells are available for new category-exclusive advertisers.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Total" value={snapshot.totalSpots} />
            <Metric label="Sold" value={snapshot.occupiedSpots} tone="blue" />
            <Metric label="Open" value={snapshot.availableSpots} tone="green" />
          </div>
        </div>

        <div
          style={{ perspective: "1400px" }}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setRotation({ x: 0, y: 0 })}
        >
          <div
            className="relative mx-auto aspect-[9/12] w-full max-w-[430px] rounded-xl bg-white p-3 text-slate-950 shadow-2xl transition-transform duration-200 will-change-transform [transform:rotateX(var(--postcard-rotate-x))_rotateY(var(--postcard-rotate-y))]"
            style={style}
          >
            <div className="absolute inset-x-8 -bottom-5 h-8 rounded-full bg-blue-950/40 blur-xl" />
            <div className="relative flex h-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                    HomeReach
                  </p>
                  <p className="text-xs font-bold text-slate-700">
                    {snapshot.cityName} shared mailer
                  </p>
                </div>
                <p className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">
                  {snapshot.sizeLabel}
                </p>
              </div>

              <div className="grid flex-1 grid-cols-3 gap-2">
                {snapshot.slots.map((slot) => (
                  <div
                    key={slot.position}
                    className={cn(
                      "group relative flex min-h-0 flex-col overflow-hidden rounded-md border p-2 shadow-sm transition",
                      slot.status === "available"
                        ? "border-dashed border-slate-300 bg-white"
                        : "border-blue-200 bg-gradient-to-br from-blue-50 to-white"
                    )}
                    title={
                      slot.status === "available"
                        ? `Open ${snapshot.slotSizeLabel} spot`
                        : `${slot.businessName ?? "Reserved advertiser"} - ${slot.categoryName ?? "Assigned category"}`
                    }
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-400">
                        {String(slot.position).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          slot.status === "active"
                            ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.75)]"
                            : slot.status === "pending"
                              ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.75)]"
                              : "bg-slate-300"
                        )}
                      />
                    </div>

                    {slot.designUrl ? (
                      <img
                        src={slot.designUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}

                    <div
                      className={cn(
                        "relative mt-auto rounded bg-white/80 p-1.5 backdrop-blur-sm",
                        slot.status === "available" && "bg-transparent p-0 backdrop-blur-0"
                      )}
                    >
                      <p
                        className={cn(
                          "line-clamp-2 text-[11px] font-black leading-tight",
                          slot.status === "available" ? "text-slate-400" : "text-slate-950"
                        )}
                      >
                        {slot.businessName ?? "Open Spot"}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                        {slot.categoryName ?? snapshot.slotSizeLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <span>12 spots per city</span>
                <span>{snapshot.slotSizeLabel} each</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "blue" | "green";
}) {
  const toneClass = {
    slate: "text-white",
    blue: "text-blue-200",
    green: "text-emerald-200",
  }[tone];

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-black", toneClass)}>{value}</p>
    </div>
  );
}
