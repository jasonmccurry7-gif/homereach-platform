import { NextResponse } from "next/server";
import { z } from "zod";
import { recomputeMarketCaptureReadiness } from "@/lib/market-capture/fulfillment";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyPublicFlowToken } from "@/lib/security/signed-token";
import { createServiceClient } from "@/lib/supabase/service";

const ASSET_BUCKET = "market-capture-assets";
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

type StatusTokenPayload = {
  scope: "market_capture_checkout";
  marketCaptureLeadId: string;
  iat: number;
  exp: number;
};

function stringValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
}

function redirectToStatus(req: Request, token: string, flag = "updated") {
  return NextResponse.redirect(new URL(`/market-capture/status?token=${encodeURIComponent(token)}&${flag}=1`, req.url), 303);
}

async function uploadClientAsset(input: {
  supabase: ReturnType<typeof createServiceClient>;
  leadId: string;
  file: File;
  assetType: string;
}) {
  const { supabase, leadId, file, assetType } = input;
  const base = {
    market_capture_lead_id: leadId,
    asset_type: assetType,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    status: "uploaded",
    approval_status: "awaiting_review",
    notes: "Uploaded from client portal.",
  };

  if (file.size > MAX_ASSET_BYTES) {
    return {
      ...base,
      status: "needs_admin_upload",
      notes: "File was larger than the 10MB portal upload limit.",
    };
  }

  const path = `${leadId}/${Date.now()}-client-${assetType}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    return {
      ...base,
      status: "needs_admin_upload",
      notes: `Storage upload failed: ${error.message}`,
    };
  }

  return {
    ...base,
    file_url: `storage://${ASSET_BUCKET}/${path}`,
  };
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req, {
    key: "market-capture-client-action",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const form = await req.formData();
  const token = stringValue(form, "token");
  const action = stringValue(form, "action");
  const verified = verifyPublicFlowToken<StatusTokenPayload>(token, "market_capture_checkout");
  if (!verified.ok) return NextResponse.json({ error: `Invalid token: ${verified.reason}` }, { status: 403 });

  const leadCheck = z.string().uuid().safeParse(verified.payload.marketCaptureLeadId);
  if (!leadCheck.success) return NextResponse.json({ error: "Invalid lead id." }, { status: 403 });

  const supabase = createServiceClient();
  const leadId = leadCheck.data;
  const now = new Date().toISOString();
  const { data: lead } = await supabase
    .from("market_capture_leads")
    .select("id, contact_name, email")
    .eq("id", leadId)
    .single();
  if (!lead) return NextResponse.json({ error: "Market Capture record not found." }, { status: 404 });

  const { data: campaign } = await supabase
    .from("market_capture_campaigns")
    .select("id")
    .eq("market_capture_lead_id", leadId)
    .maybeSingle();

  if (action === "upload_asset") {
    const assetType = stringValue(form, "assetType") || "image";
    const files = form
      .getAll("asset")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length > 0) {
      const rows = await Promise.all(files.map((file) => uploadClientAsset({ supabase, leadId, file, assetType })));
      await supabase.from("market_capture_assets").insert(rows);
      if (campaign?.id) {
        await supabase
          .from("market_capture_campaigns")
          .update({ creative_status: "uploaded", updated_at: now })
          .eq("id", campaign.id);
      }
    }
  }

  if (action === "approve" || action === "request_changes" || action === "reject") {
    const status = action === "approve" ? "approved" : action === "request_changes" ? "needs_revision" : "rejected";
    const notes = stringValue(form, "notes");
    if (campaign?.id) {
      const { data: approval } = await supabase
        .from("market_capture_approvals")
        .select("id")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (approval?.id) {
        await supabase
          .from("market_capture_approvals")
          .update({
            status,
            responded_at: now,
            notes: notes || null,
            revision_notes: status === "needs_revision" ? notes || null : null,
            updated_at: now,
          })
          .eq("id", approval.id);
      } else {
        await supabase.from("market_capture_approvals").insert({
          campaign_id: campaign.id,
          approval_type: "creative",
          status,
          client_name: lead.contact_name,
          client_email: lead.email,
          notes: notes || null,
          revision_notes: status === "needs_revision" ? notes || null : null,
          responded_at: now,
        });
      }

      await supabase
        .from("market_capture_campaigns")
        .update({ approval_status: status, updated_at: now })
        .eq("id", campaign.id);
    }
  }

  if (action === "question") {
    const content = stringValue(form, "content");
    if (content) {
      await supabase.from("market_capture_notes").insert({
        market_capture_lead_id: leadId,
        author: lead.email ?? "client",
        note_type: "client_question",
        content,
        metadata: { campaign_id: campaign?.id ?? null },
      });
    }
  }

  if (campaign?.id) {
    await recomputeMarketCaptureReadiness({ supabase, campaignId: campaign.id }).catch((err) => {
      console.error("[api/market-capture/client-action] readiness update failed:", err);
    });
  }

  return redirectToStatus(req, token);
}
