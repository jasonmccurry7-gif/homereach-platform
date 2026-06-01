import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import postgres from "postgres";

const root = process.cwd();
const baseUrl = (process.env.AGENT_MINI_APPS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const adminEmail = process.env.AGENT_MINI_APPS_E2E_EMAIL || process.env.E2E_ADMIN_EMAIL || "";
const adminPassword = process.env.AGENT_MINI_APPS_E2E_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "";
const allowMutation = process.env.AGENT_MINI_APPS_E2E_MUTATE === "1";
const allowRemote = process.env.AGENT_MINI_APPS_E2E_ALLOW_REMOTE === "1";
const isLocalBaseUrl = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(baseUrl);
const browserChannel = process.env.AGENT_MINI_APPS_E2E_BROWSER_CHANNEL || (process.platform === "win32" ? "chrome" : "");
const browserExecutablePath = process.env.AGENT_MINI_APPS_E2E_BROWSER_PATH || "";
const runId =
  process.env.AGENT_MINI_APPS_E2E_RUN_ID ||
  `E2E-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

const report = {
  checked_at: new Date().toISOString(),
  run_id: runId,
  base_url: baseUrl,
  checks: [],
  fixtures: {},
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

function connectionUrl() {
  const rootEnv = parseEnvFile(path.join(root, ".env"));
  const webEnv = parseEnvFile(path.join(root, "apps", "web", ".env.local"));
  return (
    process.env.AGENT_MINI_APPS_DB_URL ||
    process.env.DATABASE_URL ||
    webEnv.DATABASE_URL ||
    rootEnv.DATABASE_URL ||
    null
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function recordCheck(name, details = {}) {
  report.checks.push({ name, status: "pass", ...details });
}

function isoInMinutes(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function datetimeLocalInMinutes(minutes) {
  const date = new Date(Date.now() + minutes * 60_000);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

if (!allowMutation) {
  fail("Refusing to run authenticated E2E without AGENT_MINI_APPS_E2E_MUTATE=1.");
}

if (!isLocalBaseUrl && !allowRemote) {
  fail("Refusing to run against a remote base URL without AGENT_MINI_APPS_E2E_ALLOW_REMOTE=1.");
}

if (!adminEmail || !adminPassword) {
  fail("Set AGENT_MINI_APPS_E2E_EMAIL and AGENT_MINI_APPS_E2E_PASSWORD for the staging/admin QA account.");
}

const dbUrl = connectionUrl();
if (!dbUrl) {
  fail("No DATABASE_URL found. Set AGENT_MINI_APPS_DB_URL or DATABASE_URL.");
}

const db = postgres(dbUrl, {
  max: 1,
  prepare: false,
  idle_timeout: 2,
  connect_timeout: 20,
  ssl: "require",
});

let browser;

try {
  const [adminUser] = await db`
    select
      id::text,
      email,
      raw_app_meta_data->>'user_role' as user_role
    from auth.users
    where lower(email) = lower(${adminEmail})
    limit 1
  `;
  assert.ok(adminUser?.id, "QA admin user was not found in Supabase Auth.");
  assert.equal(adminUser.user_role, "admin", "QA user must have app_metadata.user_role=admin.");

  const [profile] = await db`
    select id::text
    from public.profiles
    where id = ${adminUser.id}
    limit 1
  `;
  assert.ok(profile?.id, "QA admin user must have a matching public.profiles row for audit FKs.");
  recordCheck("qa admin user exists and has admin app_metadata role");

  const fixtures = await seedFixtures(db, adminUser.id);
  report.fixtures = Object.fromEntries(
    Object.entries(fixtures).map(([key, fixture]) => [key, { id: fixture.id, title: fixture.title }]),
  );
  recordCheck("seeded deterministic mini app fixtures", { fixture_count: Object.keys(fixtures).length });

  const playwright = await import("@playwright/test");
  browser = await playwright.chromium.launch({
    headless: process.env.AGENT_MINI_APPS_E2E_HEADFUL !== "1",
    ...(browserExecutablePath ? { executablePath: browserExecutablePath } : {}),
    ...(!browserExecutablePath && browserChannel ? { channel: browserChannel } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await login(page);
  recordCheck("authenticated login reaches Today Agent Stack");

  await approveThenQueueSend(page, fixtures.outreach);
  await editApproveAndQueueProposal(page, fixtures.political);
  await approveThenGenerateQuote(page, fixtures.route);
  await requestManualTakeoverThenArchive(page, fixtures.procurement);
  await rejectMiniApp(page, fixtures.samgov);
  await approveScheduleAndComplete(page, fixtures.website);
  await archiveMiniApp(page, fixtures.generic);

  await assertDatabaseState(db, fixtures, adminUser.id);
  recordCheck("database state, execution queue, and immutable audit coverage verified");

  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ...report, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await db.end({ timeout: 2 });
}

if (process.exitCode) process.exit(process.exitCode);

async function seedFixtures(tx, actorUserId) {
  const rows = [
    {
      key: "outreach",
      mini_app_type: "outreach_approval",
      title: `${runId} Outreach approval`,
      description: "E2E fixture for approval-gated outreach send review.",
      source_agent: "E2E Outreach Agent",
      related_module: "agent_mini_apps_e2e",
      status: "needs_review",
      priority: "urgent",
      confidence_score: 92,
      risk_level: "medium",
      estimated_revenue: 3400,
      estimated_savings: 0,
      estimated_cost: 0,
      recommended_action: "Approve the draft, then queue send review without sending.",
      due_at: isoInMinutes(30),
      payload_json: {
        channel: "email",
        recipient_name: "E2E Owner",
        recipient_email: "owner@example.test",
        business_name: "E2E Roofing",
        campaign_name: "E2E Local Visibility",
        subject: "Local visibility route for review",
        message_body: "Draft only. This E2E message must never be sent.",
        previous_touch_summary: "E2E seed context.",
        suggested_follow_up_date: isoInMinutes(1440),
        call_to_action: "Review the route.",
        compliance_warning: "E2E fixture. Do not send externally.",
        personalization_notes: "Uses safe test data.",
      },
    },
    {
      key: "political",
      mini_app_type: "political_plan",
      title: `${runId} Political plan`,
      description: "E2E fixture for payload editing, approval, and proposal queueing.",
      source_agent: "E2E Political Agent",
      related_module: "agent_mini_apps_e2e",
      status: "needs_review",
      priority: "high",
      confidence_score: 88,
      risk_level: "high",
      estimated_revenue: 12500,
      estimated_savings: 0,
      estimated_cost: 4200,
      recommended_action: "Edit the plan summary, approve, then queue proposal generation.",
      due_at: isoInMinutes(60),
      payload_json: {
        candidate_name: "E2E Candidate",
        race_type: "City Council",
        geography: "Test County, OH",
        election_date: "2026-11-03",
        voter_universe_summary: "Geography-only E2E planning fixture.",
        geofence_strategy: "Test geofence around public campaign events.",
        postcard_strategy: "Complementary neighborhood postcards.",
        timeline: "Four-week E2E plan.",
        estimated_cost: 4200,
        estimated_revenue: 12500,
        creative_options: ["E2E introductory card", "E2E get-out-the-vote card"],
        proposal_summary: "Original E2E proposal summary.",
        compliance_notes: "No individual voter ideology inference.",
      },
    },
    {
      key: "route",
      mini_app_type: "route_density",
      title: `${runId} Route density`,
      description: "E2E fixture for route approval and quote queueing.",
      source_agent: "E2E Route Agent",
      related_module: "agent_mini_apps_e2e",
      status: "needs_review",
      priority: "high",
      confidence_score: 91,
      risk_level: "low",
      estimated_revenue: 7600,
      estimated_savings: 0,
      estimated_cost: 2200,
      recommended_action: "Approve the route and generate a quote task.",
      due_at: isoInMinutes(90),
      payload_json: {
        business_name: "E2E HVAC",
        service_type: "HVAC",
        target_area: "E2E Route 12",
        route_id: "E2E-R12",
        map_placeholder: "E2E map placeholder",
        household_count: 2500,
        estimated_cost: 2200,
        estimated_lead_range: "18-34",
        recommended_offer: "Spring tune-up route offer.",
        postcard_plan: "E2E postcard pairing.",
        geofence_plan: "E2E geofence pairing.",
        client_facing_summary: "E2E client-facing summary.",
      },
    },
    {
      key: "procurement",
      mini_app_type: "procurement_savings",
      title: `${runId} Procurement manual takeover`,
      description: "E2E fixture for failed task manual takeover and archive.",
      source_agent: "E2E Procurement Agent",
      related_module: "agent_mini_apps_e2e",
      status: "failed",
      priority: "urgent",
      confidence_score: 71,
      risk_level: "medium",
      estimated_revenue: 0,
      estimated_savings: 980,
      estimated_cost: 0,
      recommended_action: "Request manual takeover before any reorder action.",
      due_at: isoInMinutes(120),
      payload_json: {
        business_name: "E2E Bakery",
        current_supplier: "Current Test Supplier",
        recommended_supplier: "Recommended Test Supplier",
        item_comparisons: [{ item: "boxes", current: 1.42, recommended: 1.18 }],
        estimated_savings: 980,
        reorder_timing: "Do not reorder in E2E.",
        recommended_quantity: 0,
        quality_risk_notes: "E2E fixture. No purchase allowed.",
        savings_summary: "Potential savings only.",
        approval_notes: "Requires human approval before spend.",
      },
    },
    {
      key: "samgov",
      mini_app_type: "samgov_bid",
      title: `${runId} SAM bid reject`,
      description: "E2E fixture for bid/no-bid rejection.",
      source_agent: "E2E SAM.gov Agent",
      related_module: "agent_mini_apps_e2e",
      status: "needs_review",
      priority: "normal",
      confidence_score: 67,
      risk_level: "critical",
      estimated_revenue: 25000,
      estimated_savings: 0,
      estimated_cost: 0,
      recommended_action: "Reject the E2E opportunity. Never submit a bid.",
      due_at: isoInMinutes(150),
      payload_json: {
        opportunity_title: "E2E Facilities Mailer",
        agency: "E2E Agency",
        notice_id: "E2E-NOTICE",
        deadline: isoInMinutes(2880),
        fit_score: 42,
        revenue_potential: 25000,
        bid_no_bid_recommendation: "No bid for E2E.",
        required_documents: ["E2E checklist"],
        subcontractor_match: "None needed for test.",
        compliance_requirements: "No bid submission in E2E.",
        next_steps: "Reject fixture.",
      },
    },
    {
      key: "website",
      mini_app_type: "website_build",
      title: `${runId} Website schedule execute`,
      description: "E2E fixture for website approval, scheduling, and completion.",
      source_agent: "E2E Website Agent",
      related_module: "agent_mini_apps_e2e",
      status: "needs_review",
      priority: "normal",
      confidence_score: 84,
      risk_level: "medium",
      estimated_revenue: 1800,
      estimated_savings: 0,
      estimated_cost: 600,
      recommended_action: "Approve, schedule, then mark complete in E2E only.",
      due_at: isoInMinutes(180),
      payload_json: {
        business_name: "E2E Concrete",
        owner_name: "E2E Owner",
        domain_status: "Test domain only",
        payment_status: "No payment in E2E",
        requested_pages: ["Home", "Services", "Contact"],
        intake_completeness: "Complete",
        missing_assets: [],
        build_cost: 600,
        monthly_plan: "E2E fixture",
        codex_build_prompt_preview: "Generate a test-only website prompt.",
        launch_checklist: ["E2E approval", "E2E schedule"],
      },
    },
    {
      key: "generic",
      mini_app_type: "generic_task",
      title: `${runId} Generic archive`,
      description: "E2E fixture for archive flow.",
      source_agent: "E2E Orchestrator Agent",
      related_module: "agent_mini_apps_e2e",
      status: "needs_review",
      priority: "low",
      confidence_score: 79,
      risk_level: "low",
      estimated_revenue: 0,
      estimated_savings: 0,
      estimated_cost: 0,
      recommended_action: "Archive this E2E fixture.",
      due_at: isoInMinutes(210),
      payload_json: {
        summary: "Generic E2E archive fixture.",
      },
    },
  ];

  const inserted = await tx`
    insert into public.agent_mini_apps ${tx(
      rows.map((row) => ({
        mini_app_type: row.mini_app_type,
        title: row.title,
        description: row.description,
        source_agent: row.source_agent,
        related_module: row.related_module,
        status: row.status,
        priority: row.priority,
        confidence_score: row.confidence_score,
        risk_level: row.risk_level,
        approval_required: true,
        estimated_revenue: row.estimated_revenue,
        estimated_savings: row.estimated_savings,
        estimated_cost: row.estimated_cost,
        recommended_action: row.recommended_action,
        payload_json: tx.json(row.payload_json),
        due_at: row.due_at,
        created_by: actorUserId,
      })),
      "mini_app_type",
      "title",
      "description",
      "source_agent",
      "related_module",
      "status",
      "priority",
      "confidence_score",
      "risk_level",
      "approval_required",
      "estimated_revenue",
      "estimated_savings",
      "estimated_cost",
      "recommended_action",
      "payload_json",
      "due_at",
      "created_by",
    )}
    returning id::text, title, mini_app_type, status
  `;

  await tx`
    insert into public.agent_mini_app_events ${tx(
      inserted.map((row) => ({
        mini_app_id: row.id,
        event_type: "created",
        previous_status: null,
        new_status: row.status,
        actor_user_id: actorUserId,
        actor_type: "system",
        event_summary: `E2E fixture "${row.title}" created for ${runId}.`,
        event_payload_json: tx.json({ source: "agent-mini-apps-authenticated-e2e", runId }),
      })),
      "mini_app_id",
      "event_type",
      "previous_status",
      "new_status",
      "actor_user_id",
      "actor_type",
      "event_summary",
      "event_payload_json",
    )}
  `;

  return Object.fromEntries(
    rows.map((fixture) => {
      const insertedRow = inserted.find((row) => row.title === fixture.title);
      assert.ok(insertedRow, `Fixture insert failed for ${fixture.title}.`);
      return [fixture.key, { id: insertedRow.id, title: fixture.title }];
    }),
  );
}

async function login(page) {
  await page.goto(`${baseUrl}/login?redirect=%2Fadmin%2Fagent-mini-apps`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByLabel(/email address/i).fill(adminEmail);
  await page.getByLabel(/password/i).fill(adminPassword);
  await Promise.all([
    page.waitForURL(/\/admin\/agent-mini-apps/i, { timeout: 30_000 }),
    page.getByRole("button", { name: /^sign in$/i }).click(),
  ]);
  await page.getByRole("heading", { name: /Today's Agent Stack/i }).waitFor({ timeout: 30_000 });
}

async function searchForCard(page, fixture) {
  const search = page.getByPlaceholder(/Search title/i);
  await search.fill(fixture.title);
  const card = page.getByTestId("mini-app-card").filter({ hasText: fixture.title });
  await card.waitFor({ state: "visible", timeout: 20_000 });
  return card;
}

async function clickCardAction(page, fixture, buttonName) {
  const card = await searchForCard(page, fixture);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/agent-mini-apps/${fixture.id}/actions`) &&
      response.request().method() === "POST",
    { timeout: 20_000 },
  );
  await card.getByRole("button", { name: buttonName, exact: true }).click();
  const response = await responsePromise;
  assert.ok(response.ok(), `${buttonName} request failed with ${response.status()}.`);
  const result = await response.json();
  assert.equal(result.ok, true, `${buttonName} returned an error: ${JSON.stringify(result)}`);
  await refreshStack(page);
  return result;
}

async function editPayload(page, fixture) {
  const card = await searchForCard(page, fixture);
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const textarea = card.locator("textarea");
  const original = JSON.parse(await textarea.inputValue());
  const edited = {
    ...original,
    proposal_summary: `Edited by ${runId} authenticated E2E.`,
    e2e_reviewed: true,
  };
  await textarea.fill(JSON.stringify(edited, null, 2));

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/agent-mini-apps/${fixture.id}/actions`) &&
      response.request().method() === "POST",
    { timeout: 20_000 },
  );
  await card.getByTestId("mini-app-save-payload-edit").click();
  const response = await responsePromise;
  assert.ok(response.ok(), `Payload edit failed with ${response.status()}.`);
  const result = await response.json();
  assert.equal(result.ok, true, `Payload edit returned an error: ${JSON.stringify(result)}`);
  await refreshStack(page);
}

async function scheduleMiniApp(page, fixture) {
  const card = await searchForCard(page, fixture);
  await card.getByRole("button", { name: "Schedule", exact: true }).click();
  await card.locator('input[type="datetime-local"]').fill(datetimeLocalInMinutes(300));

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/agent-mini-apps/${fixture.id}/actions`) &&
      response.request().method() === "POST",
    { timeout: 20_000 },
  );
  await card.getByTestId("mini-app-confirm-schedule").click();
  const response = await responsePromise;
  assert.ok(response.ok(), `Schedule failed with ${response.status()}.`);
  const result = await response.json();
  assert.equal(result.ok, true, `Schedule returned an error: ${JSON.stringify(result)}`);
  await refreshStack(page);
}

async function refreshStack(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Today's Agent Stack/i }).waitFor({ timeout: 30_000 });
}

async function approveThenQueueSend(page, fixture) {
  await clickCardAction(page, fixture, "Approve");
  await waitForMiniAppStatus(db, fixture.id, "approved");
  await clickCardAction(page, fixture, "Queue Send");
  await waitForMiniAppStatus(db, fixture.id, "sent_to_execution_queue");
  recordCheck("outreach approval queued send review");
}

async function editApproveAndQueueProposal(page, fixture) {
  await editPayload(page, fixture);
  await waitForMiniAppStatus(db, fixture.id, "edited");
  await clickCardAction(page, fixture, "Approve");
  await waitForMiniAppStatus(db, fixture.id, "approved");
  await clickCardAction(page, fixture, "Generate Proposal");
  await waitForMiniAppStatus(db, fixture.id, "sent_to_execution_queue");
  recordCheck("political plan edit, approval, and proposal queue verified");
}

async function approveThenGenerateQuote(page, fixture) {
  await clickCardAction(page, fixture, "Approve");
  await waitForMiniAppStatus(db, fixture.id, "approved");
  await clickCardAction(page, fixture, "Generate Quote");
  await waitForMiniAppStatus(db, fixture.id, "sent_to_execution_queue");
  recordCheck("route density approval and quote queue verified");
}

async function requestManualTakeoverThenArchive(page, fixture) {
  await clickCardAction(page, fixture, "Manual Takeover");
  await clickCardAction(page, fixture, "Archive");
  await waitForMiniAppStatus(db, fixture.id, "archived");
  recordCheck("procurement failed item manual takeover and archive verified");
}

async function rejectMiniApp(page, fixture) {
  await clickCardAction(page, fixture, "Reject");
  await waitForMiniAppStatus(db, fixture.id, "rejected");
  recordCheck("SAM.gov bid rejection verified");
}

async function approveScheduleAndComplete(page, fixture) {
  await clickCardAction(page, fixture, "Approve");
  await waitForMiniAppStatus(db, fixture.id, "approved");
  await scheduleMiniApp(page, fixture);
  await waitForMiniAppStatus(db, fixture.id, "scheduled");
  await clickCardAction(page, fixture, "Mark Complete");
  await waitForMiniAppStatus(db, fixture.id, "executed");
  recordCheck("website build approval, schedule, and completion verified");
}

async function archiveMiniApp(page, fixture) {
  await clickCardAction(page, fixture, "Archive");
  await waitForMiniAppStatus(db, fixture.id, "archived");
  recordCheck("generic archive verified");
}

async function waitForMiniAppStatus(tx, miniAppId, expectedStatus) {
  const deadline = Date.now() + 20_000;
  let lastStatus = null;
  while (Date.now() < deadline) {
    const [row] = await tx`
      select status
      from public.agent_mini_apps
      where id = ${miniAppId}
      limit 1
    `;
    lastStatus = row?.status ?? null;
    if (lastStatus === expectedStatus) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.equal(lastStatus, expectedStatus, `Mini app ${miniAppId} did not reach ${expectedStatus}.`);
}

async function assertDatabaseState(tx, fixtures, actorUserId) {
  const expectedStatuses = {
    [fixtures.outreach.id]: "sent_to_execution_queue",
    [fixtures.political.id]: "sent_to_execution_queue",
    [fixtures.route.id]: "sent_to_execution_queue",
    [fixtures.procurement.id]: "archived",
    [fixtures.samgov.id]: "rejected",
    [fixtures.website.id]: "executed",
    [fixtures.generic.id]: "archived",
  };

  const rows = await tx`
    select id::text, title, status, payload_json, edited_payload_json, decision, decision_reason
    from public.agent_mini_apps
    where id in ${tx(Object.keys(expectedStatuses))}
  `;
  assert.equal(rows.length, Object.keys(expectedStatuses).length, "Expected all E2E mini apps to exist.");

  for (const row of rows) {
    assert.equal(row.status, expectedStatuses[row.id], `${row.title} had unexpected status.`);
  }

  const political = rows.find((row) => row.id === fixtures.political.id);
  assert.ok(political?.payload_json?.proposal_summary, "Political original payload was missing.");
  assert.equal(
    political.payload_json.proposal_summary,
    "Original E2E proposal summary.",
    "Original payload should remain preserved after edit.",
  );
  assert.equal(
    political.edited_payload_json?.e2e_reviewed,
    true,
    "Edited payload should be stored separately.",
  );

  const events = await tx`
    select mini_app_id::text, event_type, actor_user_id::text, previous_status, new_status
    from public.agent_mini_app_events
    where mini_app_id in ${tx(Object.keys(expectedStatuses))}
    order by created_at asc
  `;

  const requiredEvents = {
    [fixtures.outreach.id]: ["created", "approved", "sent_to_execution_queue"],
    [fixtures.political.id]: ["created", "edited", "approved", "sent_to_execution_queue"],
    [fixtures.route.id]: ["created", "approved", "sent_to_execution_queue"],
    [fixtures.procurement.id]: ["created", "manual_takeover_requested", "archived"],
    [fixtures.samgov.id]: ["created", "rejected"],
    [fixtures.website.id]: ["created", "approved", "scheduled", "executed"],
    [fixtures.generic.id]: ["created", "archived"],
  };

  for (const [miniAppId, eventTypes] of Object.entries(requiredEvents)) {
    const actualTypes = events.filter((event) => event.mini_app_id === miniAppId).map((event) => event.event_type);
    for (const eventType of eventTypes) {
      assert.ok(actualTypes.includes(eventType), `Missing ${eventType} audit event for ${miniAppId}.`);
    }
  }

  const userEvents = events.filter((event) => event.event_type !== "created");
  assert.ok(userEvents.length > 0, "Expected user-driven audit events.");
  assert.ok(
    userEvents.every((event) => event.actor_user_id === actorUserId),
    "All UI-driven audit events should carry the QA admin actor id.",
  );

  const queueRows = await tx`
    select
      mini_app_id::text,
      task_type,
      target_system,
      permission_scope,
      status,
      human_approval_required,
      approved_by,
      approved_at,
      retry_allowed,
      manual_takeover_required
    from public.agent_execution_queue
    where mini_app_id in ${tx([fixtures.outreach.id, fixtures.political.id, fixtures.route.id])}
  `;

  assert.equal(queueRows.length, 3, "Expected three execution queue rows.");
  for (const queueRow of queueRows) {
    assert.equal(queueRow.status, "queued");
    assert.equal(queueRow.human_approval_required, true);
    assert.equal(queueRow.retry_allowed, false);
    assert.equal(queueRow.manual_takeover_required, false);
    assert.equal(queueRow.approved_by, null);
    assert.equal(queueRow.approved_at, null);
  }

  const outreachQueue = queueRows.find((row) => row.mini_app_id === fixtures.outreach.id);
  assert.equal(outreachQueue?.permission_scope, "send_after_approval");
  assert.equal(outreachQueue?.task_type, "approved_outreach_send_review");

  const politicalQueue = queueRows.find((row) => row.mini_app_id === fixtures.political.id);
  assert.equal(politicalQueue?.permission_scope, "prepare_only");
  assert.equal(politicalQueue?.task_type, "generate_proposal");

  const routeQueue = queueRows.find((row) => row.mini_app_id === fixtures.route.id);
  assert.equal(routeQueue?.permission_scope, "prepare_only");
  assert.equal(routeQueue?.task_type, "generate_quote");
}
