"use server";

import { db, profiles } from "@homereach/db";
import { eq } from "drizzle-orm";

export async function updateProfile(
  userId: string,
  data: { fullName: string; phone: string }
): Promise<{ error: string } | void> {
  const fullName = data.fullName.trim();
  const phone = data.phone.trim();

  if (!fullName) {
    return { error: "Full name is required." };
  }

  try {
    await db
      .update(profiles)
      .set({
        fullName,
        phone: phone || null,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId));
  } catch {
    return { error: "Failed to save. Please try again." };
  }
}
