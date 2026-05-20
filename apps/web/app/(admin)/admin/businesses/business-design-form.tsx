"use client";

import { useActionState } from "react";
import {
  uploadBusinessPostcardDesign,
  type DesignUploadState,
} from "./design-actions";

type BusinessDesignFormProps = {
  businessId: string;
  businessName: string;
  currentDesignUrl: string | null;
};

const INITIAL_STATE: DesignUploadState = {
  ok: false,
  message: "",
};

export function BusinessDesignForm({
  businessId,
  businessName,
  currentDesignUrl,
}: BusinessDesignFormProps) {
  const [state, formAction, isPending] = useActionState(
    uploadBusinessPostcardDesign,
    INITIAL_STATE
  );
  const previewUrl = state.designUrl ?? currentDesignUrl;

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="min-w-[220px] space-y-2"
    >
      <input type="hidden" name="businessId" value={businessId} />

      <div className="flex items-center gap-3">
        <div
          className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 bg-cover bg-center"
          role={previewUrl ? "img" : undefined}
          aria-label={previewUrl ? `${businessName} postcard design` : undefined}
          style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
        >
          {previewUrl ? (
            <span className="sr-only">{businessName} postcard design attached</span>
          ) : (
            <span className="px-1 text-center text-[10px] font-medium uppercase tracking-wide text-gray-400">
              No art
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <input
            type="file"
            name="designFile"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="block w-full text-xs text-gray-500 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
          />
          <input
            type="url"
            name="designUrl"
            placeholder="Or paste image URL"
            className="block w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <select
            name="designSource"
            className="block w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            defaultValue="manual_url"
          >
            <option value="manual_url">Client artwork URL</option>
            <option value="generated">Generated artwork URL</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Attaching..." : "Attach design"}
        </button>
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Open
          </a>
        )}
      </div>

      {state.message && (
        <p className={`text-xs ${state.ok ? "text-green-700" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
