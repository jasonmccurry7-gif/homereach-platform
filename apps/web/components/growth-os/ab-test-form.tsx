"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";

export function AbTestForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      testType: formData.get("testType"),
      primaryMetric: formData.get("primaryMetric"),
      hypothesis: formData.get("hypothesis"),
      variantAName: formData.get("variantAName"),
      variantADescription: formData.get("variantADescription"),
      variantAPrice: emptyToUndefined(formData.get("variantAPrice")),
      variantBName: formData.get("variantBName"),
      variantBDescription: formData.get("variantBDescription"),
      variantBPrice: emptyToUndefined(formData.get("variantBPrice")),
    };

    try {
      const response = await fetch("/api/growth-os/ab-tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Could not create test");
      }

      event.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create test");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
          <FlaskConical className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            New Test
          </p>
          <h2 className="text-xl font-bold text-gray-950">
            Pricing or bundle variation
          </h2>
        </div>
      </div>

      <fieldset disabled={disabled || pending} className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="testType"
            label="Test type"
            options={[
              ["pricing", "Pricing"],
              ["bundle", "Bundle"],
            ]}
          />
          <SelectField
            name="primaryMetric"
            label="Primary metric"
            options={[
              ["aov_cents", "AOV"],
              ["revenue_cents", "Revenue"],
              ["orders", "Orders"],
            ]}
          />
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-semibold text-gray-700">Hypothesis</span>
          <input
            name="hypothesis"
            required
            maxLength={240}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
            placeholder="Bundle B will lift AOV without reducing orders"
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <VariantFields prefix="A" />
          <VariantFields prefix="B" />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={disabled || pending}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
        )}
        Start test
      </button>
      {disabled ? (
        <p className="mt-3 text-sm font-medium text-gray-500">
          A/B tests require one active lever and no active A/B test.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
    </form>
  );
}

function VariantFields({ prefix }: { prefix: "A" | "B" }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="font-bold text-gray-950">Variant {prefix}</p>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-gray-700">Name</span>
          <input
            name={`variant${prefix}Name`}
            required
            maxLength={80}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
            placeholder={prefix === "A" ? "Current offer" : "New offer"}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-gray-700">Description</span>
          <textarea
            name={`variant${prefix}Description`}
            required
            maxLength={300}
            rows={3}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-gray-700">Price</span>
          <input
            name={`variant${prefix}Price`}
            type="number"
            min="0"
            step="0.01"
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </label>
      </div>
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <select
        name={name}
        className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
      >
        {options.map(([value, display]) => (
          <option key={value} value={value}>
            {display}
          </option>
        ))}
      </select>
    </label>
  );
}

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") return undefined;
  return Number(value);
}
