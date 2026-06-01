import type { User } from "@supabase/supabase-js";
import type { ApiGuardResult, AppRole } from "@/lib/auth/api-guards";
import { roleOf } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";

type GuardedServiceRoleOptions = {
  allowedRoles: readonly AppRole[];
  guard: ApiGuardResult;
  purpose: string;
  route: string;
};

type GuardedActor = {
  email: string | null;
  id: string | null;
  label: string;
  role: AppRole | "system";
};

function actorFromUser(user: User | undefined): GuardedActor {
  const role = user ? roleOf(user) ?? "client" : "system";
  return {
    email: user?.email ?? null,
    id: user?.id ?? null,
    label: user?.email ?? user?.id ?? "system",
    role,
  };
}

export function createGuardedServiceRoleClient({
  allowedRoles,
  guard,
  purpose,
  route,
}: GuardedServiceRoleOptions) {
  if (!guard.ok) {
    throw new Error("Service-role access requires a successful authorization guard.");
  }

  const actor = actorFromUser(guard.user);
  if (actor.role === "system" || !allowedRoles.includes(actor.role)) {
    throw new Error("Service-role access denied for this actor.");
  }

  if (!purpose.trim() || !route.trim()) {
    throw new Error("Service-role access requires a purpose and route.");
  }

  return {
    actor,
    audit: {
      actor_email: actor.email,
      actor_id: actor.id,
      actor_role: actor.role,
      no_autonomous_action: true,
      purpose,
      route,
    },
    supabase: createServiceClient(),
  };
}
