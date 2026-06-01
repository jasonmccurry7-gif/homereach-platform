import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import postgres from "postgres";

const root = process.cwd();
const requireFromWeb = createRequire(path.join(root, "apps", "web", "package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const email = process.env.AGENT_MINI_APPS_E2E_EMAIL || process.env.E2E_ADMIN_EMAIL || "";
const password = process.env.AGENT_MINI_APPS_E2E_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "";
const bootstrapEnabled = process.env.AGENT_MINI_APPS_E2E_BOOTSTRAP === "1";
const resetPassword = process.env.AGENT_MINI_APPS_E2E_RESET_PASSWORD === "1";
const allowAnyEmail = process.env.AGENT_MINI_APPS_E2E_ALLOW_ANY_EMAIL === "1";
const fullName = process.env.AGENT_MINI_APPS_E2E_FULL_NAME || "HomeReach Agent Mini Apps E2E Admin";

const report = {
  checked_at: new Date().toISOString(),
  ok: false,
  email: email ? redactEmail(email) : null,
  created_user: false,
  updated_app_metadata: false,
  reset_password: false,
  ensured_profile: false,
  verified_password: false,
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function envValue(name) {
  const rootEnv = parseEnvFile(path.join(root, ".env"));
  const webEnv = parseEnvFile(path.join(root, "apps", "web", ".env.local"));
  return process.env[name] || webEnv[name] || rootEnv[name] || null;
}

function connectionUrl() {
  return (
    process.env.AGENT_MINI_APPS_DB_URL ||
    process.env.DATABASE_URL ||
    envValue("DATABASE_URL") ||
    null
  );
}

function fail(message) {
  console.error(JSON.stringify({ ...report, error: message }, null, 2));
  process.exit(1);
}

function redactEmail(value) {
  const [name, domain] = String(value).split("@");
  if (!name || !domain) return "[invalid-email]";
  return `${name.slice(0, 2)}***@${domain}`;
}

function assertSafeEmail(value) {
  if (allowAnyEmail) return;
  const normalized = value.toLowerCase();
  const safe =
    normalized.includes("e2e") ||
    normalized.includes("qa") ||
    normalized.includes("test") ||
    normalized.endsWith(".test");
  assert.ok(
    safe,
    "Refusing to bootstrap an admin user unless the email looks like a QA/E2E/test account. Set AGENT_MINI_APPS_E2E_ALLOW_ANY_EMAIL=1 only for an intentionally isolated staging project.",
  );
}

if (!bootstrapEnabled) {
  fail("Refusing to bootstrap QA admin without AGENT_MINI_APPS_E2E_BOOTSTRAP=1.");
}

if (!email || !password) {
  fail("Set AGENT_MINI_APPS_E2E_EMAIL and AGENT_MINI_APPS_E2E_PASSWORD.");
}

try {
  assertSafeEmail(email);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const supabaseUrl = envValue("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
const dbUrl = connectionUrl();

if (!supabaseUrl || !anonKey || !serviceRoleKey || !dbUrl) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const anonClient = createClient(supabaseUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const db = postgres(dbUrl, {
  max: 1,
  prepare: false,
  idle_timeout: 2,
  connect_timeout: 20,
  ssl: "require",
});

try {
  let [userRow] = await db`
    select
      id::text,
      email,
      raw_app_meta_data,
      raw_app_meta_data->>'user_role' as user_role
    from auth.users
    where lower(email) = lower(${email})
    limit 1
  `;

  if (!userRow) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        user_role: "admin",
        e2e: true,
        agent_mini_apps_e2e: true,
      },
      user_metadata: {
        full_name: fullName,
      },
    });
    if (error) throw error;
    assert.ok(data?.user?.id, "Supabase did not return the created user id.");
    report.created_user = true;
  } else {
    const nextAppMetadata = {
      ...(userRow.raw_app_meta_data ?? {}),
      user_role: "admin",
      e2e: true,
      agent_mini_apps_e2e: true,
    };
    const updatePayload = {
      app_metadata: nextAppMetadata,
      user_metadata: {
        full_name: fullName,
      },
    };
    if (resetPassword) {
      updatePayload.password = password;
      report.reset_password = true;
    }
    const { error } = await adminClient.auth.admin.updateUserById(userRow.id, updatePayload);
    if (error) throw error;
    report.updated_app_metadata = true;
  }

  [userRow] = await db`
    select
      id::text,
      email,
      raw_app_meta_data->>'user_role' as user_role
    from auth.users
    where lower(email) = lower(${email})
    limit 1
  `;
  assert.ok(userRow?.id, "QA admin user was not found after bootstrap.");
  assert.equal(userRow.user_role, "admin", "QA admin user app_metadata.user_role was not set to admin.");

  await db`
    insert into public.profiles (id, email, full_name, role, updated_at)
    values (${userRow.id}, ${email}, ${fullName}, 'admin', now())
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      role = 'admin',
      updated_at = now()
  `;
  report.ensured_profile = true;

  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(
      resetPassword
        ? `QA admin was bootstrapped but password verification failed: ${signInError.message}`
        : `Password verification failed. If this is the intended QA account, rerun with AGENT_MINI_APPS_E2E_RESET_PASSWORD=1.`,
    );
  }
  assert.equal(signInData.user?.app_metadata?.user_role, "admin", "Verified session did not include admin app_metadata role.");
  await anonClient.auth.signOut();
  report.verified_password = true;

  const [profile] = await db`
    select id::text, email, role
    from public.profiles
    where id = ${userRow.id}
    limit 1
  `;
  assert.equal(profile?.role, "admin", "Profile row was not set to admin.");

  report.ok = true;
  report.user_id = userRow.id;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ...report,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 2 });
}

if (process.exitCode) process.exit(process.exitCode);
