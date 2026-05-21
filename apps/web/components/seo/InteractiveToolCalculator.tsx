"use client";

import { useMemo, useState } from "react";
import type { InteractiveSeoTool } from "@/lib/seo/authority";

export function InteractiveToolCalculator({ tool }: { tool: InteractiveSeoTool }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(tool.inputs.map((input) => [input.key, input.defaultValue])),
  );

  const result = useMemo(() => calculate(tool.calculatorType, values), [tool.calculatorType, values]);

  return (
    <section className="bg-slate-950 px-4 py-16 text-white lg:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">Interactive estimator</p>
          <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">{tool.outputLabel}</h2>
          <p className="mt-5 text-base leading-8 text-slate-300">
            This tool is built for planning and lead capture. Final pricing, maps, campaign volume, and savings claims should be reviewed before proposal delivery.
          </p>
          <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.06] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Estimated output</p>
            <p className="mt-2 text-4xl font-black text-white">{result.primary}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{result.secondary}</p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20">
          <div className="grid gap-5">
            {tool.inputs.map((input) => (
              <div key={input.key} className="grid gap-2">
                <label htmlFor={`seo-tool-${input.key}`} className="text-sm font-black text-slate-100">
                  {input.label}
                </label>
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
                  {input.suffix === "$" ? <span className="text-sm font-bold text-slate-400">$</span> : null}
                  <input
                    id={`seo-tool-${input.key}`}
                    type="number"
                    min={0}
                    value={values[input.key] ?? 0}
                    onChange={(event) => setValues((current) => ({ ...current, [input.key]: Number(event.target.value) }))}
                    className="min-h-11 w-full bg-transparent text-base font-bold text-white outline-none"
                  />
                  {input.suffix && input.suffix !== "$" ? <span className="text-sm font-bold text-slate-400">{input.suffix}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3">
            {tool.guidance.map((item) => (
              <p key={item} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function calculate(type: InteractiveSeoTool["calculatorType"], values: Record<string, number>) {
  const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

  switch (type) {
    case "postcard_roi": {
      const customers = Math.max(1, Math.ceil((values.cost ?? 0) / Math.max(values.ticket ?? 1, 1)));
      const leads = Math.ceil(customers / Math.max((values.closeRate ?? 1) / 100, 0.01));
      return {
        primary: `${number.format(customers)} customers`,
        secondary: `Roughly ${number.format(leads)} leads at the close rate entered. Use the proposal to validate geography, creative, and offer strength.`,
      };
    }
    case "household_reach":
      return {
        primary: `${number.format((values.routes ?? 0) * (values.homesPerRoute ?? 0) * (values.drops ?? 0))} impressions`,
        secondary: "Household impressions estimate repeat mail touches, not unique households.",
      };
    case "political_mail":
      return {
        primary: `${number.format((values.households ?? 0) * (values.waves ?? 0))} postcards`,
        secondary: `Spread across roughly ${number.format(values.days ?? 0)} campaign-window days before final approval.`,
      };
    case "coverage":
      return {
        primary: `${number.format((values.routes ?? 0) * (values.density ?? 0) * ((values.coverage ?? 0) / 100))} households`,
        secondary: "A coverage estimate should be paired with a map before being used in a proposal.",
      };
    case "procurement_savings":
      return {
        primary: currency.format((values.monthlySpend ?? 0) * ((values.savingsRate ?? 0) / 100) * (values.months ?? 0)),
        secondary: "Savings should be verified against supplier data before any outreach or proposal claim.",
      };
    case "saturation":
      return {
        primary: `${number.format((values.households ?? 0) * (values.drops ?? 0))} touches`,
        secondary: `Modeled across ${number.format(values.months ?? 0)} months for repeat neighborhood visibility.`,
      };
    default:
      return { primary: "Estimate ready", secondary: "Review the plan before publishing or sending." };
  }
}
