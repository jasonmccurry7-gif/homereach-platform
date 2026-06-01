import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OPERATIONS_COPILOT_PATH = "/operations-copilot";

export default async function FindMySavingsRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? OPERATIONS_COPILOT_PATH : `/login?redirect=${OPERATIONS_COPILOT_PATH}`);
}
