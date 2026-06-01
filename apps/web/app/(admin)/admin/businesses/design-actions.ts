"use server";

import { revalidatePath } from "next/cache";
import { db, businesses } from "@homereach/db";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertPostcardDesignMeta, type PostcardDesignSource } from "@/lib/spots/design-metadata";

export type DesignUploadState = {
  ok: boolean;
  message: string;
  designUrl?: string;
};

const MAX_DESIGN_UPLOAD_BYTES = 15 * 1024 * 1024;
const DEFAULT_DESIGN_BUCKET = "postcard-designs";
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function initialState(message: string): DesignUploadState {
  return { ok: false, message };
}

async function requireAdmin(): Promise<DesignUploadState | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return initialState("Sign in required.");
  if (user.app_metadata?.user_role !== "admin") return initialState("Admin access required.");

  return null;
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getExtension(fileName: string, mimeType: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_IMAGE_EXTENSIONS.has(extension)) return extension;
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function sanitizeFileName(fileName: string): string {
  const cleanName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleanName || "postcard-design";
}

function validateDesignUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveUrlSource(value: string): PostcardDesignSource {
  return value === "generated" ? "generated" : "manual_url";
}

async function uploadDesignFile(
  businessId: string,
  file: File
): Promise<
  | { ok: true; designUrl: string; storagePath: string; fileName: string }
  | { ok: false; message: string }
> {
  if (file.size > MAX_DESIGN_UPLOAD_BYTES) {
    return { ok: false, message: "Design upload must be 15MB or smaller." };
  }

  const extension = getExtension(file.name, file.type);
  const mimeIsAllowed = ALLOWED_IMAGE_MIME_TYPES.has(file.type);
  const extensionIsAllowed = ALLOWED_IMAGE_EXTENSIONS.has(extension);

  if (!mimeIsAllowed && !extensionIsAllowed) {
    return { ok: false, message: "Upload a JPG, PNG, or WEBP design file." };
  }

  const bucket = process.env.POSTCARD_DESIGN_BUCKET ?? DEFAULT_DESIGN_BUCKET;
  const safeName = sanitizeFileName(file.name || `postcard-design.${extension}`);
  const storagePath = `shared-postcards/${businessId}/${Date.now()}-${safeName}`;
  const supabase = createServiceClient();

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type || `image/${extension}`,
    upsert: true,
  });

  if (error) {
    return {
      ok: false,
      message: `Upload failed. Check Supabase bucket "${bucket}" and service role storage permissions.`,
    };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return {
    ok: true,
    designUrl: data.publicUrl,
    storagePath,
    fileName: file.name || safeName,
  };
}

export async function uploadBusinessPostcardDesign(
  _previousState: DesignUploadState,
  formData: FormData
): Promise<DesignUploadState> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const businessId = getString(formData, "businessId");
  if (!businessId) return initialState("Missing business id.");

  const [business] = await db
    .select({
      id: businesses.id,
      notes: businesses.notes,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) return initialState("Business not found.");

  const fileValue = formData.get("designFile");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const pastedUrl = validateDesignUrl(getString(formData, "designUrl"));
  const urlSource = resolveUrlSource(getString(formData, "designSource"));

  let designUrl: string | null = null;
  let storagePath: string | undefined;
  let fileName: string | undefined;
  let source: PostcardDesignSource = "manual_url";

  if (file) {
    const upload = await uploadDesignFile(business.id, file);
    if (!upload.ok) return initialState(upload.message);

    designUrl = upload.designUrl;
    storagePath = upload.storagePath;
    fileName = upload.fileName;
    source = "manual_upload";
  } else if (pastedUrl) {
    designUrl = pastedUrl;
    source = urlSource;
  } else {
    return initialState("Upload a design file or paste a public image URL.");
  }

  const notes = upsertPostcardDesignMeta(business.notes, {
    designUrl,
    source,
    uploadedAt: new Date().toISOString(),
    storagePath,
    fileName,
  });

  await db
    .update(businesses)
    .set({
      notes,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, business.id));

  revalidatePath("/admin/businesses");
  revalidatePath("/get-started");
  revalidatePath("/get-started/[citySlug]", "page");
  revalidatePath("/get-started/[citySlug]/[categorySlug]", "page");

  return {
    ok: true,
    message: "Design attached to the shared postcard visual.",
    designUrl,
  };
}
