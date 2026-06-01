import { NextResponse } from "next/server";
import {
  generateAiWebAssistantProfile,
  getAssistantTemplate,
  type AiWebAssistantSetupInput,
} from "@/lib/ai-web-assistant/sample-data";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

function text(value: unknown, max = 600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => text(item, 120))
      .filter(Boolean)
      .slice(0, 12);
  }

  return text(value, 1200)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isEnabled() {
  return process.env.ENABLE_AI_WEB_ASSISTANT !== "false" && process.env.ENABLE_AI_WEB_ASSISTANT_DEMO !== "false";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createEmbedKey(businessName: string) {
  const slug =
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "assistant";
  return `demo_${slug}_${crypto.randomUUID().slice(0, 8)}`;
}

function assistantSetupPriority(input: AiWebAssistantSetupInput) {
  const plan = (input.preferredPlan ?? "").toLowerCase();
  const contactPreference = (input.contactPreference ?? "").toLowerCase();
  const bookingPreference = (input.bookingPreference ?? "").toLowerCase();
  if (plan.includes("revenue") || plan.includes("growth")) return "high";
  if (
    contactPreference.includes("urgent") ||
    contactPreference.includes("emergency") ||
    bookingPreference.includes("urgent") ||
    bookingPreference.includes("emergency")
  ) {
    return "high";
  }
  return "medium";
}

async function createAiWorkforceSetupTask(input: {
  supabase: ReturnType<typeof createServiceClient>;
  assistantId: string;
  embedKey: string;
  setupInput: AiWebAssistantSetupInput;
  profile: ReturnType<typeof generateAiWebAssistantProfile>;
}) {
  const { supabase, assistantId, embedKey, setupInput, profile } = input;
  const clientLabel = setupInput.businessName || setupInput.contactName || setupInput.email;
  const taskPublicId = `WF-AIWEB-DEMO-${assistantId.slice(0, 8).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const inputData = {
    source: "public_ai_web_assistant_demo",
    sourceRoute: "/services/ai-website-assistant#assistant-demo",
    productIntent: "ai-website-assistant",
    assistantId,
    embedKey,
    contact: {
      name: setupInput.contactName,
      businessName: setupInput.businessName,
      email: setupInput.email,
      phone: setupInput.phone || null,
      websiteUrl: setupInput.websiteUrl || null,
    },
    assistantSetup: setupInput,
    generatedProfile: {
      assistantName: profile.assistantName,
      tone: profile.tone,
      setupChecklist: profile.setupChecklist,
      leadQualificationFlow: profile.leadQualificationFlow,
      handoffRules: profile.handoffRules,
      restrictedTopics: profile.restrictedTopics,
    },
    approvalGate:
      "Human approval required before live widget activation, domain/embed approval, outbound follow-up, appointment confirmation, pricing promises, public review replies, Google/profile changes, or compliance-sensitive answers.",
    nextAction:
      "Review the generated assistant profile, confirm knowledge base gaps, approve routing rules, quote the selected founder pilot plan, and keep the widget inactive until content and domain approval are complete.",
  };

  const { data: task, error: taskError } = await supabase
    .from("ai_workforce_tasks")
    .insert({
      task_id: taskPublicId,
      workflow_name: "AI Website Assistant Setup",
      requestor: "Public AI Website Assistant demo form",
      assigned_agent: "Orchestrator Agent",
      priority: assistantSetupPriority(setupInput),
      status: "new",
      input_path: `/admin/ai-web-assistant?assistant=${assistantId}`,
      input_data: inputData,
      expected_output:
        "Prepare a review-ready AI Website Assistant setup brief with knowledge base gaps, routing rules, domain readiness, selected plan, approval owner, safe client follow-up, and activation checklist. Do not activate the widget or send outbound messages without approval.",
      dependencies: [
        "ai_web_assistants",
        "ai_web_assistant_knowledge_items",
        "ai_web_assistant_settings",
        "AI Assets business context",
        "human_widget_activation_approval",
      ],
      due_date: dueDate,
      approval_required: true,
      related_client: clientLabel,
      related_opportunity: "ai-website-assistant",
    })
    .select("id,task_id,assigned_agent")
    .single();

  if (taskError || !task) {
    throw new Error(taskError?.message ?? "AI Workforce setup task was not created.");
  }

  const { error: logError } = await supabase.from("ai_workforce_activity_logs").insert({
    task_id: task.id,
    task_public_id: task.task_id,
    agent_name: task.assigned_agent,
    event_type: "ai_web_assistant_demo_received",
    status: "new",
    summary: `AI Website Assistant demo request received from ${clientLabel}.`,
    details: {
      source: "public_ai_web_assistant_demo",
      assistantId,
      embedKey,
      productIntent: "ai-website-assistant",
      selectedPlan: setupInput.preferredPlan || "not_selected",
      approvalRequired: true,
      noAutonomousAction: true,
      nextAction:
        "Qualify the request, approve knowledge/routing/domain details, and prepare a human-approved client follow-up before activation.",
    },
    approval_status: "needs_review",
  });

  if (logError) throw new Error(logError.message);

  return {
    id: task.id as string,
    taskId: task.task_id as string,
    assignedAgent: task.assigned_agent as string,
  };
}

export async function POST(req: Request) {
  if (!isEnabled()) {
    return NextResponse.json({ ok: false, error: "AI Website Assistant demos are not enabled." }, { status: 404 });
  }

  const rateLimited = checkRateLimit(req, {
    key: "ai-web-assistant-demo",
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = text(body.email, 180).toLowerCase();
  const consent = body.consent === true;
  const input: AiWebAssistantSetupInput = {
    businessName: text(body.businessName, 180),
    contactName: text(body.contactName, 140),
    email,
    websiteUrl: text(body.websiteUrl, 500),
    phone: text(body.phone, 80),
    category: text(body.category, 120),
    serviceAreas: list(body.serviceAreas),
    mainServices: list(body.mainServices),
    hours: text(body.hours, 500),
    bookingPreference: text(body.bookingPreference, 500),
    contactPreference: text(body.contactPreference, 500),
    preferredPlan: text(body.preferredPlan, 80),
  };

  if (
    !input.businessName ||
    !input.contactName ||
    !input.email ||
    !isEmail(input.email) ||
    !input.category ||
    input.serviceAreas.length === 0 ||
    input.mainServices.length === 0
  ) {
    return NextResponse.json(
      { ok: false, error: "Business name, contact name, valid email, category, service areas, and main services are required." },
      { status: 400 },
    );
  }

  if (!consent) {
    return NextResponse.json(
      { ok: false, error: "Please confirm HomeReach can generate the demo and contact you about setup." },
      { status: 400 },
    );
  }

  const embedKey = createEmbedKey(input.businessName);
  const profile = generateAiWebAssistantProfile(input, {
    embedKey,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com",
  });
  const template = getAssistantTemplate(input.category);
  let persisted = false;
  let persistenceWarning: string | null = null;
  let aiWorkforceTask:
    | {
        id: string;
        taskId: string;
        assignedAgent: string;
      }
    | null = null;
  let aiWorkforceTaskWarning: string | null = null;

  if (hasSupabaseServiceEnv()) {
    const supabase = createServiceClient();
    const { data: assistant, error: assistantError } = await supabase
      .from("ai_web_assistants")
      .insert({
        business_name: input.businessName,
        website_url: input.websiteUrl || null,
        phone: input.phone || null,
        business_category: input.category,
        service_areas: input.serviceAreas,
        main_services: input.mainServices,
        hours: input.hours || null,
        booking_preference: input.bookingPreference || null,
        contact_preference: input.contactPreference || null,
        assistant_name: profile.assistantName,
        greeting: profile.greeting,
        tone: profile.tone,
        embed_key: embedKey,
        status: "demo_requested",
        source: "public_ai_web_assistant_demo",
        settings: {
          reviewWorkflow: profile.reviewWorkflow,
          localSeoInsight: profile.localSeoInsight,
          setupChecklist: profile.setupChecklist,
        },
        metadata: {
          contactName: input.contactName,
          email: input.email,
          preferredPlan: input.preferredPlan || "not_selected",
          consentCaptured: true,
          consentCapturedAt: new Date().toISOString(),
          salesStatus: "new_demo_request",
          nextAction: "Review assistant demo request and contact prospect.",
          humanApprovalRequired: true,
        },
      })
      .select("id")
      .single();

    if (assistantError || !assistant) {
      persistenceWarning = "Demo generated, but the AI Web Assistant tables are not available yet. Apply the AI Web Assistant migration.";
    } else {
      const assistantId = assistant.id as string;
      const knowledgeRows = [
        ...profile.basicFaq.slice(0, 8).map((content, index) => ({
          ai_web_assistant_id: assistantId,
          item_type: "faq",
          title: `FAQ ${index + 1}`,
          content,
          source: "generated_setup",
          approval_status: "needs_review",
        })),
        ...profile.restrictedTopics.map((content, index) => ({
          ai_web_assistant_id: assistantId,
          item_type: "guardrail",
          title: `Restricted topic ${index + 1}`,
          content,
          source: "generated_setup",
          approval_status: "approved",
        })),
      ];

      const childResults = await Promise.all([
        supabase.from("ai_web_assistant_knowledge_items").insert(knowledgeRows),
        supabase.from("ai_web_assistant_settings").insert({
          ai_web_assistant_id: assistantId,
          tone: profile.tone,
          greeting: profile.greeting,
          business_hours: { raw: input.hours || null },
          escalation_rules: profile.escalationRules,
          qualification_questions: profile.leadQualificationFlow,
          restricted_topics: profile.restrictedTopics,
          handoff_rules: profile.handoffRules,
          booking_rules: { preference: input.bookingPreference || null },
          prompt_guardrails: {
            noAutonomousOutbound: true,
            noPricingPromises: true,
            noSensitiveAdvice: true,
            captureAndHandoffWhenUncertain: true,
          },
        }),
        supabase.from("ai_web_assistant_routing_rules").insert(
          template.handoffTriggers.slice(0, 8).map((trigger) => ({
            ai_web_assistant_id: assistantId,
            rule_name: trigger,
            trigger_type: "handoff_trigger",
            trigger_value: trigger,
            urgency_level: trigger.toLowerCase().includes("urgent") || trigger.toLowerCase().includes("emergency") ? "high" : "medium",
            route_to: input.contactPreference || "Business owner",
            instructions: "Capture contact information, summarize the request, and alert the assigned owner. Do not promise resolution.",
            approval_required: true,
            status: "needs_review",
          })),
        ),
        supabase.from("ai_web_assistant_activity_logs").insert({
          ai_web_assistant_id: assistantId,
          actor_type: "system",
          action_type: "demo_profile_generated",
          approval_status: "draft",
          risk_level: "low",
          payload: {
            input,
            profile,
            consentCaptured: true,
            approvalRequiredFor: ["live widget activation", "outbound follow-up", "pricing promises", "appointment confirmation"],
          },
        }),
      ]);
      const failedChildInsert = childResults.find((result) => result.error);
      if (failedChildInsert) {
        console.error("[ai-web-assistant/demo] child insert failed", failedChildInsert.error);
        persistenceWarning =
          "Demo generated and the setup request was saved, but some setup checklist records need admin review.";
      } else {
        persisted = true;
      }

      try {
        aiWorkforceTask = await createAiWorkforceSetupTask({
          supabase,
          assistantId,
          embedKey,
          setupInput: input,
          profile,
        });
      } catch (err) {
        console.error("[ai-web-assistant/demo] AI Workforce setup task failed", err);
        aiWorkforceTaskWarning =
          "Demo generated and assistant setup records were saved, but the AI Workforce setup task needs admin review.";
      }
    }
  }

  return NextResponse.json({
    ok: true,
    profile,
    persisted,
    persistenceWarning,
    aiWorkforceTask,
    aiWorkforceTaskWarning,
  });
}
