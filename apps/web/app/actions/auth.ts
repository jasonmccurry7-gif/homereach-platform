"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// signOut
// Server action — clears the Supabase session cookie and redirects to /login.
// Use in any layout or component via a <form action={signOut}> button.
// ─────────────────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
