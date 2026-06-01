"use client";

import { useState } from "react";
import { ClipboardCopy, Download, FileText, Loader2 } from "lucide-react";

const ARTIFACT_OPTIONS = [
  { value: "weekly_action_plan", label: "Weekly plan" },
  { value: "pricing_script", label: "Pricing script" },
  { value: "bundle_configuration", label: "Bundle config" },
  { value: "staffing_schedule", label: "Staffing rec" },
  { value: "customer_message", label: "Customer message draft" },
] as const;

type Artifact = {
  title: string;
  filename: string;
  content: string;
};

export function ActionGeneratorPanel() {
  const [artifactType, setArtifactType] =
    useState<(typeof ARTIFACT_OPTIONS)[number]["value"]>("weekly_action_plan");
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateArtifact() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/growth-os/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifactType }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not generate artifact");
      }

      setArtifact((await response.json()) as Artifact);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate artifact"
      );
    } finally {
      setPending(false);
    }
  }

  async function copyArtifact() {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadArtifact() {
    if (!artifact) return;
    const blob = new Blob([artifact.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = artifact.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Draft Generator
          </p>
          <h2 className="text-xl font-bold text-gray-950">
            Create review-ready instructions
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            Generates copyable plans and scripts. Nothing is sent, posted, or
            changed until a person approves it.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <select
          value={artifactType}
          onChange={(event) =>
            setArtifactType(
              event.target.value as (typeof ARTIFACT_OPTIONS)[number]["value"]
            )
          }
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium outline-none ring-blue-600 focus:ring-2"
        >
          {ARTIFACT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={generateArtifact}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4" aria-hidden="true" />
          )}
          Draft for review
        </button>
      </div>

      {artifact ? (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-bold text-gray-950">{artifact.title}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyArtifact}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={downloadArtifact}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </button>
            </div>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-gray-700">
            {artifact.content}
          </pre>
          <p className="mt-3 text-xs font-medium leading-5 text-gray-500">
            Review facts, pricing, and customer-facing claims before using this
            draft in the business.
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
    </section>
  );
}
