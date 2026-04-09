"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  DesignEngine,
  type GeneratedAd,
  type AdDesignInput,
  type AdCopy,
  type AnchorAdSchema,
  type StandardAdSchema,
  type ColorPalette,
} from "@/lib/ad-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step = "input" | "preview" | "edit" | "approved";

interface Props {
  categories: Array<{ key: string; label: string; icon: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "input",    label: "Business Info"  },
  { key: "preview",  label: "Ad Preview"     },
  { key: "edit",     label: "Edit & Refine"  },
  { key: "approved", label: "Approved"       },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition",
            i < idx  ? "bg-green-900/40 text-green-400" :
            i === idx? "bg-blue-600 text-white"         :
                       "bg-gray-800 text-gray-500"
          )}>
            {i < idx ? "✓" : <span className="w-4 text-center">{i + 1}</span>}
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("w-6 h-0.5 mx-1", i < idx ? "bg-green-700" : "bg-gray-700")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Business Input Form
// ─────────────────────────────────────────────────────────────────────────────

function InputForm({
  categories,
  onGenerate,
}: {
  categories: Props["categories"];
  onGenerate: (input: AdDesignInput) => void;
}) {
  const [form, setForm] = useState<AdDesignInput>({
    businessName: "", category: "roofing", slotType: "anchor",
    phone: "", website: "", offer: "", notes: "", hasQr: false,
  });
  const [errors, setErrors] = useState<string[]>([]);

  function update(patch: Partial<AdDesignInput>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!form.businessName.trim()) errs.push("Business name is required");
    if (!form.category)            errs.push("Business category is required");
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    onGenerate(form);
  }

  const selectedCat = categories.find((c) => c.key === form.category);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Slot Type */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Ad Slot Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: "anchor",   label: "Anchor Ad",   sub: "12″ × 6.5″ · Premium layout",     badge: "FULL WIDTH" },
            { value: "standard", label: "Standard Ad", sub: "4″ × 3.5″ · Compact layout",       badge: "COMPACT"   },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ slotType: opt.value })}
              className={cn(
                "text-left p-4 rounded-xl border-2 transition",
                form.slotType === opt.value
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-white">{opt.label}</p>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-bold",
                  form.slotType === opt.value ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"
                )}>{opt.badge}</span>
              </div>
              <p className="text-xs text-gray-500">{opt.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Business Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.businessName}
          onChange={(e) => update({ businessName: e.target.value })}
          placeholder="e.g. Medina Roofing Co."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Business Category <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <select
            value={form.category}
            onChange={(e) => update({ category: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm appearance-none focus:border-blue-500 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
          <span className="absolute right-4 top-3 text-gray-500 pointer-events-none">▾</span>
        </div>
        {selectedCat && (
          <p className="text-xs text-gray-500 mt-1.5">
            {selectedCat.icon} Copy and color palette will be tuned for {selectedCat.label}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Phone Number
        </label>
        <input
          type="tel"
          value={form.phone ?? ""}
          onChange={(e) => update({ phone: e.target.value })}
          placeholder="(330) 555-0100"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Website */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Website
        </label>
        <input
          type="url"
          value={form.website ?? ""}
          onChange={(e) => update({ website: e.target.value })}
          placeholder="https://yourbusiness.com"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Custom Offer */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Special Offer <span className="text-gray-600">(optional)</span>
        </label>
        <input
          type="text"
          value={form.offer ?? ""}
          onChange={(e) => update({ offer: e.target.value })}
          placeholder="e.g. Free Inspection · 10% Off · Free Estimate"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <p className="text-xs text-gray-600 mt-1">Leave blank to use a category-appropriate offer automatically</p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Notes <span className="text-gray-600">(optional)</span>
        </label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Any specific messaging, seasonal focus, or copy direction..."
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>

      {/* QR Code toggle */}
      <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <input
          type="checkbox"
          id="hasQr"
          checked={form.hasQr ?? false}
          onChange={(e) => update({ hasQr: e.target.checked })}
          className="w-4 h-4 accent-blue-600"
        />
        <label htmlFor="hasQr" className="text-sm text-gray-300 cursor-pointer">
          Include QR code placeholder
        </label>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-xl p-4">
          {errors.map((e) => (
            <p key={e} className="text-sm text-red-400">⚠ {e}</p>
          ))}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition"
      >
        ✨ Generate Ad Design
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANCHOR AD PREVIEW RENDERER
// ─────────────────────────────────────────────────────────────────────────────

function AnchorAdPreview({ schema }: { schema: AnchorAdSchema }) {
  const { contentSide: c, imageSide: img, palette: p } = schema;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl shadow-2xl select-none"
      style={{ aspectRatio: "12/6.5", background: p.primary }}
    >
      {/* Content pane — left 54% */}
      <div
        className="absolute inset-y-0 left-0 flex flex-col p-[4%]"
        style={{
          width: "54%",
          background: `linear-gradient(135deg, ${p.primary} 0%, ${adjustBrightness(p.primary, -15)} 100%)`,
        }}
      >
        {/* Header row: logo + business name + badge */}
        <div className="flex items-center gap-[2%] mb-[4%]">
          {/* Logo */}
          <div
            className="flex items-center justify-center rounded-lg text-[1.4vw] font-extrabold shrink-0"
            style={{
              width: "8%", aspectRatio: "1",
              background: p.secondary, color: p.secondaryText,
              minWidth: 28, minHeight: 28,
              fontSize: "clamp(9px, 1.2vw, 18px)",
            }}
          >
            {c.logoText}
          </div>
          <p
            className="font-bold truncate flex-1"
            style={{ color: p.muted, fontSize: "clamp(7px, 0.85vw, 13px)" }}
          >
            {c.businessName}
          </p>
          {c.badgeText && (
            <span
              className="px-[2.5%] py-[1%] rounded-full font-extrabold uppercase whitespace-nowrap shrink-0"
              style={{
                background: p.accent, color: p.accentText,
                fontSize: "clamp(6px, 0.7vw, 10px)",
              }}
            >
              {c.badgeText}
            </span>
          )}
        </div>

        {/* Headline */}
        <div className="flex-1 flex flex-col justify-center gap-[3%]">
          <h2
            className="font-extrabold leading-tight"
            style={{
              color: p.primaryText,
              fontSize: "clamp(11px, 2.0vw, 30px)",
              lineHeight: 1.15,
            }}
          >
            {c.headline}
          </h2>

          {/* Subheadline */}
          {c.subheadline && (
            <p
              className="font-medium leading-snug"
              style={{ color: p.muted, fontSize: "clamp(7px, 0.9vw, 13px)" }}
            >
              {c.subheadline}
            </p>
          )}

          {/* Offer box */}
          {c.offerText && (
            <div
              className="rounded-lg px-[4%] py-[2%] mt-[2%]"
              style={{
                background: `${p.accent}28`,
                border: `1.5px solid ${p.accent}60`,
              }}
            >
              <p
                className="font-bold"
                style={{ color: p.accent, fontSize: "clamp(7px, 0.9vw, 13px)" }}
              >
                ⭐ {c.offerText}
              </p>
            </div>
          )}
        </div>

        {/* Bottom: CTA + contact */}
        <div className="mt-[4%] space-y-[2.5%]">
          <div
            className="inline-block rounded-xl px-[5%] py-[2%] font-bold"
            style={{
              background: p.secondary, color: p.secondaryText,
              fontSize: "clamp(7px, 0.85vw, 13px)",
            }}
          >
            {c.ctaText} →
          </div>
          <p
            className="font-medium"
            style={{ color: p.muted, fontSize: "clamp(6px, 0.75vw, 11px)" }}
          >
            {[c.phone && `📞 ${c.phone}`, c.website && `🌐 ${c.website}`].filter(Boolean).join("  ·  ")}
          </p>
        </div>
      </div>

      {/* Image pane — right 46% */}
      <div
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-[4%]"
        style={{ width: "46%", background: p.imageBg }}
      >
        {/* Diagonal texture lines */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
            backgroundSize: "16px 16px",
          }}
        />
        <span style={{ fontSize: "clamp(28px, 5vw, 72px)", zIndex: 1 }}>{img.categoryIcon}</span>
        <div
          className="text-center px-[6%] rounded-xl py-[2%] z-10"
          style={{ background: "#FFFFFF12", border: "1px dashed #FFFFFF30" }}
        >
          <p className="font-bold uppercase tracking-widest" style={{ color: "#FFFFFF60", fontSize: "clamp(6px, 0.65vw, 10px)" }}>
            {img.placeholderLabel}
          </p>
          <p className="font-medium" style={{ color: "#FFFFFF40", fontSize: "clamp(5px, 0.55vw, 9px)" }}>
            High-res photo recommended
          </p>
        </div>
      </div>

      {/* Print safe margin indicator */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ border: "1px dashed #FFFFFF15" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDARD AD PREVIEW RENDERER
// ─────────────────────────────────────────────────────────────────────────────

function StandardAdPreview({ schema }: { schema: StandardAdSchema }) {
  const { header: h, body: b, footer: f, palette: p } = schema;

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-2xl select-none mx-auto"
      style={{
        aspectRatio: "4/3.5",
        maxWidth: 320,
        background: `linear-gradient(160deg, ${p.primary} 0%, ${adjustBrightness(p.primary, -20)} 100%)`,
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-[3%] px-[5%] py-[3%]"
        style={{ background: "#00000025" }}
      >
        <div
          className="flex items-center justify-center rounded-md font-extrabold shrink-0"
          style={{
            width: "14%", aspectRatio: "1",
            background: p.secondary, color: p.secondaryText,
            fontSize: "clamp(9px, 2.5vw, 14px)",
          }}
        >
          {h.logoText}
        </div>
        <p
          className="font-bold truncate"
          style={{ color: p.primaryText, fontSize: "clamp(8px, 2vw, 13px)" }}
        >
          {h.businessName}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-col items-center justify-center text-center px-[6%] pt-[4%] pb-[2%]" style={{ flex: 1 }}>
        <h3
          className="font-extrabold leading-tight"
          style={{
            color: p.primaryText,
            fontSize: "clamp(11px, 3.8vw, 20px)",
            lineHeight: 1.2,
          }}
        >
          {b.headline}
        </h3>
        {b.offerLine && (
          <div
            className="mt-[4%] px-[5%] py-[2.5%] rounded-lg w-full"
            style={{ background: `${p.accent}30`, border: `1px solid ${p.accent}50` }}
          >
            <p
              className="font-bold"
              style={{ color: p.accent, fontSize: "clamp(8px, 2.5vw, 14px)" }}
            >
              {b.offerLine}
            </p>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-[5%] py-[3.5%]"
        style={{ background: p.secondary }}
      >
        <p
          className="font-bold"
          style={{ color: p.secondaryText, fontSize: "clamp(7px, 2.2vw, 12px)" }}
        >
          {f.ctaText} →
        </p>
        {f.phone && (
          <p
            className="font-semibold shrink-0"
            style={{ color: p.secondaryText, fontSize: "clamp(6px, 1.8vw, 11px)" }}
          >
            📞 {f.phone}
          </p>
        )}
      </div>

      {/* Safe margin border */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ border: "1px dashed #FFFFFF15" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT PANEL
// ─────────────────────────────────────────────────────────────────────────────

function EditPanel({
  ad,
  onSave,
  onCancel,
}: {
  ad: GeneratedAd;
  onSave: (patch: Partial<AdCopy>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<AdCopy>({ ...ad.copy });

  function field(
    key: keyof AdCopy,
    label: string,
    placeholder?: string,
    multiline?: boolean
  ) {
    const value = draft[key] ?? "";
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          {label}
        </label>
        {multiline ? (
          <textarea
            value={value as string}
            onChange={onChange}
            placeholder={placeholder}
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
          />
        ) : (
          <input
            type="text"
            value={value as string}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-3 mb-4">
        <p className="text-xs text-blue-400 font-medium">
          ✏️ Edit any field below. Changes update the preview live.
        </p>
      </div>

      {field("headline",    "Headline",     "Main attention-grabbing line")}
      {field("subheadline", "Subheadline",  "Supporting detail (anchor ads)", true)}
      {field("offer",       "Offer",        "e.g. Free Inspection, 10% Off")}
      {field("cta",         "Call-to-Action","e.g. Call for Free Estimate")}
      {field("phone",       "Phone",        "(330) 555-0100")}
      {field("website",     "Website",      "yourbusiness.com")}
      {field("badgeText",   "Badge Text",   "e.g. FREE OFFER, LIMITED TIME")}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onSave(draft)}
          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition"
        >
          Update Preview
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVED SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function ApprovedPanel({ ad, onNew }: { ad: GeneratedAd; onNew: () => void }) {
  const exportData = DesignEngine.export(ad);
  const [copied, setCopied] = useState(false);

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadPrint() {
    const d   = exportData.dimensions;
    const inp = ad.input;

    // Pull text elements for the print sheet
    const textEls = exportData.elements
      .filter((e: { type: string }) => e.type === "text")
      .map((e: { value?: string; role?: string; fontSize?: number; fontWeight?: string }) =>
        `<tr>
          <td style="padding:4px 8px;color:#888;font-size:11px">${e.role ?? "text"}</td>
          <td style="padding:4px 8px;font-size:13px;font-weight:${e.fontWeight ?? "normal"}">${e.value ?? ""}</td>
        </tr>`
      ).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Print Sheet – ${inp.businessName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #555; font-size: 13px; margin-bottom: 24px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 13px; font-weight: bold; text-transform: uppercase;
                letter-spacing: .06em; color: #888; border-bottom: 1px solid #ddd;
                padding-bottom: 6px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
  .spec-label { color: #888; font-size: 11px; width: 140px; }
  .spec-val   { font-size: 13px; font-family: monospace; }
  .ad-box {
    border: 2px dashed #ccc;
    padding: 24px;
    text-align: center;
    background: ${inp.colorPalette?.background ?? "#fff"};
    color: ${inp.colorPalette?.primary ?? "#111"};
    margin-top: 12px;
  }
  .ad-headline { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
  .ad-sub      { font-size: 15px; margin-bottom: 6px; }
  .ad-cta      { display: inline-block; margin-top: 12px; padding: 8px 20px;
                 background: ${inp.colorPalette?.accent ?? "#2563eb"};
                 color: #fff; font-weight: bold; font-size: 14px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <h1>📄 Print Sheet — ${inp.businessName}</h1>
  <p class="sub">
    ${DesignEngine.getSlotLabel(inp.slotType)} &nbsp;|&nbsp;
    Approved ${new Date(ad.approvedAt!).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
  </p>

  <div class="section">
    <h2>Print Specifications</h2>
    <table>
      <tr><td class="spec-label">Slot Type</td><td class="spec-val">${exportData.slotType}</td></tr>
      <tr><td class="spec-label">Final Size</td><td class="spec-val">${d.widthIn}″ × ${d.heightIn}″</td></tr>
      <tr><td class="spec-label">Bleed</td><td class="spec-val">${d.bleedIn}″ all sides</td></tr>
      <tr><td class="spec-label">Safe Zone</td><td class="spec-val">${d.safeMarginIn}″ inside bleed</td></tr>
      <tr><td class="spec-label">Resolution</td><td class="spec-val">300 DPI minimum</td></tr>
      <tr><td class="spec-label">Color Mode</td><td class="spec-val">CMYK</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Ad Copy</h2>
    <table>${textEls}</table>
  </div>

  <div class="section">
    <h2>Visual Preview (Screen Approximation)</h2>
    <div class="ad-box">
      <div class="ad-headline">${ad.copy?.headline ?? inp.businessName}</div>
      <div class="ad-sub">${ad.copy?.subheadline ?? ""}</div>
      <div class="ad-sub">${ad.copy?.body ?? ""}</div>
      <div class="ad-cta">${ad.copy?.cta ?? "Learn More"}</div>
    </div>
    <p style="font-size:11px;color:#aaa;margin-top:6px">
      * This preview is for layout reference only. Final print file must be produced at 300 DPI in CMYK.
    </p>
  </div>

  <div class="section no-print" style="margin-top:32px">
    <button onclick="window.print()"
      style="padding:10px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:bold;border:none;cursor:pointer">
      🖨 Print / Save as PDF
    </button>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const slug = inp.businessName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    a.href     = url;
    a.download = `${slug}-print-sheet.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-900/30 border border-green-700/50 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-bold text-white mb-1">Ad Approved!</h3>
        <p className="text-sm text-gray-400">
          {ad.input.businessName} · {DesignEngine.getSlotLabel(ad.input.slotType)}
        </p>
        <p className="text-xs text-gray-600 mt-2">
          Approved {new Date(ad.approvedAt!).toLocaleString("en-US", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
          })}
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={downloadPrint}
          className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
        >
          🖨 Download for Print
        </button>
        <button
          onClick={copyJson}
          className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
        >
          {copied ? "✓ Copied!" : "📋 Copy Export JSON (Canva / Print Ready)"}
        </button>
        <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700 text-xs text-gray-400 font-mono overflow-auto max-h-40">
          <pre>{JSON.stringify({ slotType: exportData.slotType, dimensions: exportData.dimensions, elementCount: exportData.elements.length }, null, 2)}</pre>
        </div>
        <button
          onClick={onNew}
          className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm transition"
        >
          ← Create Another Ad
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Print Specs</p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-gray-500">Size</p><p className="text-white font-mono">{exportData.dimensions.widthIn}″ × {exportData.dimensions.heightIn}″</p></div>
          <div><p className="text-gray-500">Bleed</p><p className="text-white font-mono">{exportData.dimensions.bleedIn}″ all sides</p></div>
          <div><p className="text-gray-500">Safe Zone</p><p className="text-white font-mono">{exportData.dimensions.safeMarginIn}″ inside bleed</p></div>
          <div><p className="text-gray-500">Export Elements</p><p className="text-white font-mono">{exportData.elements.length} objects</p></div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLIENT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AdDesignerClient({ categories }: Props) {
  const [step,        setStep]        = useState<Step>("input");
  const [ad,          setAd]          = useState<GeneratedAd | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [approving,   setApproving]   = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [variantIdx,  setVariantIdx]  = useState(0);
  const [toast,       setToast]       = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleGenerate(input: AdDesignInput) {
    setGenerating(true);
    // Simulate brief generation delay for UX
    setTimeout(() => {
      const generated = DesignEngine.generate(input, variantIdx);
      setAd(generated);
      setStep("preview");
      setEditMode(false);
      setGenerating(false);
    }, 600);
  }

  function handleRegenerate() {
    if (!ad) return;
    const nextVariant = (variantIdx + 1) % 3;
    setVariantIdx(nextVariant);
    const regenerated = DesignEngine.regenerateCopy(ad, nextVariant);
    setAd(regenerated);
    showToast("New variant generated!");
  }

  function handleEditSave(patch: Partial<AdCopy>) {
    if (!ad) return;
    const updated = DesignEngine.applyEdit(ad, patch);
    setAd(updated);
    setEditMode(false);
    showToast("Ad updated!");
  }

  function handleApprove() {
    if (!ad) return;
    setApproving(true);
    setTimeout(() => {
      const result = DesignEngine.approve(ad);
      if (result.ok) {
        setAd(result.ad);
        setStep("approved");
      } else {
        showToast("⚠ " + result.errors.join(" · "));
      }
      setApproving(false);
    }, 400);
  }

  function handleNew() {
    setAd(null);
    setStep("input");
    setEditMode(false);
    setVariantIdx(0);
  }

  const isAnchor = ad?.input.slotType === "anchor";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">🎨 Ad Designer</h1>
            <p className="text-xs text-gray-500">Auto-generate print-ready ad designs for your postcard slots</p>
          </div>
          <StepBar current={step} />
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="p-6 max-w-[1400px] mx-auto">

        {/* ── STEP: INPUT ──────────────────────────────────────────────────── */}
        {step === "input" && (
          <div className="max-w-lg mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-white mb-1">Business Details</h2>
              <p className="text-xs text-gray-500 mb-6">
                Enter your business info and we'll generate a conversion-ready ad design instantly.
              </p>
              {generating ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-4 animate-pulse">✨</div>
                  <p className="text-white font-semibold">Generating your ad...</p>
                  <p className="text-xs text-gray-500 mt-2">Tuning copy and layout for your category</p>
                </div>
              ) : (
                <InputForm categories={categories} onGenerate={handleGenerate} />
              )}
            </div>
          </div>
        )}

        {/* ── STEP: PREVIEW / EDIT / APPROVE ───────────────────────────────── */}
        {(step === "preview" || step === "edit") && ad && (
          <div className={cn(
            "grid gap-6",
            isAnchor ? "grid-cols-1 xl:grid-cols-3" : "grid-cols-1 lg:grid-cols-2"
          )}>

            {/* ── Left: Controls ─────────────────────────────────────────── */}
            <div className={cn("space-y-4", isAnchor ? "xl:col-span-1" : "")}>

              {/* Ad meta */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm"
                    style={{ background: ad.schema.palette.secondary }}
                  >
                    {ad.input.businessName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{ad.input.businessName}</p>
                    <p className="text-xs text-gray-500">
                      {DesignEngine.getCategoryMeta(ad.input.category).icon}{" "}
                      {DesignEngine.getCategoryMeta(ad.input.category).label} ·{" "}
                      {DesignEngine.getSlotLabel(ad.input.slotType)}
                    </p>
                  </div>
                  <span className={cn(
                    "ml-auto text-xs font-semibold px-2 py-0.5 rounded-full",
                    DesignEngine.getStatusLabel(ad.status).color,
                    "bg-gray-800"
                  )}>
                    {DesignEngine.getStatusLabel(ad.status).label}
                  </span>
                </div>

                {/* Variant info */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <span>Variant {ad.variantIndex + 1} of 3</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        i === ad.variantIndex ? "bg-blue-500" : "bg-gray-700"
                      )} />
                    ))}
                  </div>
                </div>

                {!editMode ? (
                  <div className="space-y-2.5">
                    <button
                      onClick={() => setEditMode(true)}
                      className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
                    >
                      ✏️ Edit Text
                    </button>
                    <button
                      onClick={handleRegenerate}
                      className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
                    >
                      🔄 Try Different Variant
                    </button>
                    <button
                      onClick={handleNew}
                      className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition"
                    >
                      ← Start Over
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {approving ? "Approving..." : "✅ Approve Design"}
                    </button>
                  </div>
                ) : (
                  <EditPanel
                    ad={ad}
                    onSave={handleEditSave}
                    onCancel={() => setEditMode(false)}
                  />
                )}
              </div>

              {/* Copy summary */}
              {!editMode && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Generated Copy</p>
                  <dl className="space-y-2">
                    {[
                      ["Headline",     ad.copy.headline],
                      ["Subheadline",  ad.copy.subheadline],
                      ["Offer",        ad.copy.offer],
                      ["CTA",          ad.copy.cta],
                      ["Phone",        ad.copy.phone],
                      ["Website",      ad.copy.website],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label} className="flex gap-3">
                        <dt className="text-xs text-gray-500 w-24 shrink-0 pt-0.5">{label}</dt>
                        <dd className="text-xs text-white leading-relaxed">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            {/* ── Right: Preview ─────────────────────────────────────────── */}
            <div className={cn("space-y-4", isAnchor ? "xl:col-span-2" : "")}>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-white">Ad Preview</p>
                    <p className="text-xs text-gray-500">
                      {isAnchor ? "12″ × 6.5″ — Front Anchor Slot" : "4″ × 3.5″ — Standard Slot"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600 border border-gray-700 px-2 py-1 rounded-lg">
                    Screen preview — print output will be higher resolution
                  </span>
                </div>

                {/* Preview render area */}
                <div ref={previewRef} className="w-full">
                  {ad.schema.type === "anchor" ? (
                    <AnchorAdPreview schema={ad.schema as AnchorAdSchema} />
                  ) : (
                    <div className="flex justify-center">
                      <StandardAdPreview schema={ad.schema as StandardAdSchema} />
                    </div>
                  )}
                </div>

                {/* Print constraints info */}
                <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>📐 Bleed: 0.125″ all sides</span>
                  <span>🎯 Safe margin: 0.125″ inside bleed</span>
                  <span>🖨 Min 300 DPI for print</span>
                  <span>✅ High contrast verified</span>
                </div>
              </div>

              {/* Print-ready note */}
              <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl p-4">
                <p className="text-xs text-amber-400 font-medium">
                  ⚡ Future: One-click export to Canva template or PDF print file
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Export schema is ready — connect Canva API or print vendor to activate
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: APPROVED ──────────────────────────────────────────────── */}
        {step === "approved" && ad && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-sm font-bold text-white mb-4">Final Preview</p>
              {ad.schema.type === "anchor" ? (
                <AnchorAdPreview schema={ad.schema as AnchorAdSchema} />
              ) : (
                <div className="flex justify-center">
                  <StandardAdPreview schema={ad.schema as StandardAdSchema} />
                </div>
              )}
            </div>
            <ApprovedPanel ad={ad} onNew={handleNew} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Darken or lighten a hex color by a given amount */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r   = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g   = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b   = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
