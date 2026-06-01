export type AiWebAssistantSetupInput = {
  businessName: string;
  contactName?: string;
  email?: string;
  websiteUrl?: string;
  phone?: string;
  category: string;
  serviceAreas: string[];
  mainServices: string[];
  hours?: string;
  bookingPreference?: string;
  contactPreference?: string;
  preferredPlan?: string;
};

export type AiWebAssistantTemplate = {
  name: string;
  categoryKeywords: string[];
  leadQuestions: string[];
  urgencyRules: string[];
  faqs: string[];
  recommendedCtas: string[];
  commonObjections: string[];
  handoffTriggers: string[];
};

export type AiWebAssistantProfile = {
  assistantName: string;
  greeting: string;
  tone: string;
  serviceList: string[];
  serviceAreas: string[];
  basicFaq: string[];
  leadQualificationFlow: string[];
  escalationRules: string[];
  restrictedTopics: string[];
  handoffRules: string[];
  reviewWorkflow: string;
  localSeoInsight: string;
  embedKey: string;
  embedCode: string;
  setupChecklist: string[];
  previewConversation: Array<{ speaker: "assistant" | "visitor"; text: string }>;
};

export type AiWebAssistantAgent = {
  name: string;
  role: string;
  allowedActions: string[];
  approvalRequiredFor: string[];
};

export type AiWebAssistantAction = {
  title: string;
  detail: string;
  cta: string;
  urgency: "high" | "medium" | "low";
  status: "needs_review" | "draft_ready" | "monitoring" | "blocked";
};

export type AiWebAssistantSnapshot = {
  metrics: {
    conversationsHandled: number;
    leadsCaptured: number;
    conversionRate: string;
    afterHoursLeads: number;
    unansweredQuestions: number;
    followUpsNeeded: number;
  };
  conversations: Array<{
    visitor: string;
    service: string;
    urgency: "high" | "medium" | "low";
    status: string;
    sourcePage: string;
    summary: string;
  }>;
  leads: Array<{
    name: string;
    serviceNeed: string;
    contact: string;
    estimatedValue: string;
    nextAction: string;
  }>;
  actions: AiWebAssistantAction[];
  alerts: AiWebAssistantAction[];
  agents: AiWebAssistantAgent[];
  templates: AiWebAssistantTemplate[];
};

export const aiWebAssistantTemplates: AiWebAssistantTemplate[] = [
  {
    name: "Roofing",
    categoryKeywords: ["roof", "roofing", "gutter"],
    leadQuestions: ["What issue are you seeing?", "Is there active leaking?", "What city is the property in?", "When would you like a call back?"],
    urgencyRules: ["Active leak, storm damage, or interior water gets high urgency.", "Inspection and quote requests stay medium urgency."],
    faqs: ["Do you offer roof inspections?", "What areas do you serve?", "Can someone look at storm damage?", "Do you handle insurance-related questions?"],
    recommendedCtas: ["Request roof inspection", "Ask for a callback", "Send photos for review"],
    commonObjections: ["I am just pricing it out", "I need to talk to insurance", "I am not ready yet"],
    handoffTriggers: ["Active leak", "Insurance question", "Large commercial property", "Angry or distressed customer"],
  },
  {
    name: "HVAC",
    categoryKeywords: ["hvac", "heating", "cooling", "furnace", "air conditioning", "ac"],
    leadQuestions: ["Is this heating, cooling, or maintenance?", "Is the system currently working?", "What city is the property in?", "How soon do you need service?"],
    urgencyRules: ["No heat, no cooling during extreme weather, or safety concerns get high urgency.", "Maintenance and tuneups stay low or medium urgency."],
    faqs: ["Do you offer emergency service?", "Can I request a tuneup?", "What brands do you service?", "Do you provide replacement estimates?"],
    recommendedCtas: ["Request service", "Book a tuneup", "Ask for replacement estimate"],
    commonObjections: ["I need a rough price", "I want a second opinion", "I am comparing companies"],
    handoffTriggers: ["No heat", "No cooling", "Gas smell", "Carbon monoxide concern", "Same-day request"],
  },
  {
    name: "Plumbing",
    categoryKeywords: ["plumb", "drain", "pipe", "water heater"],
    leadQuestions: ["What plumbing issue do you need help with?", "Is water actively leaking?", "What city is the property in?", "Do you need emergency service?"],
    urgencyRules: ["Active leak, sewer backup, no water, or water heater failure get high urgency.", "Fixture installs and estimates stay medium urgency."],
    faqs: ["Do you handle emergencies?", "Do you install water heaters?", "Can you clear drains?", "What areas do you serve?"],
    recommendedCtas: ["Request plumbing help", "Send emergency callback", "Schedule estimate"],
    commonObjections: ["Can you tell me the price first?", "I need someone today", "I am waiting on my landlord"],
    handoffTriggers: ["Sewer backup", "Burst pipe", "No water", "Emergency request"],
  },
  {
    name: "Landscaping",
    categoryKeywords: ["landscap", "lawn", "mulch", "mowing", "hardscape"],
    leadQuestions: ["What outdoor work do you need?", "Is this one-time or recurring?", "What city is the property in?", "When would you like the work done?"],
    urgencyRules: ["Storm cleanup and commercial property issues get high urgency.", "Routine mowing and estimates stay medium urgency."],
    faqs: ["Do you offer recurring lawn care?", "Do you handle mulch and cleanup?", "What areas do you serve?", "Can I request an estimate?"],
    recommendedCtas: ["Request landscape estimate", "Ask for recurring service", "Send photos"],
    commonObjections: ["I just need a quick quote", "I am comparing landscapers", "I only need a one-time cleanup"],
    handoffTriggers: ["Commercial account", "Storm cleanup", "Large hardscape project", "Very tight deadline"],
  },
  {
    name: "Restaurants",
    categoryKeywords: ["restaurant", "pizza", "cafe", "coffee", "bar", "bakery"],
    leadQuestions: ["Are you asking about hours, menu, catering, or an order issue?", "What date do you need help with?", "How should the team reach you?"],
    urgencyRules: ["Same-day order issue, catering question, or customer complaint gets high urgency.", "General menu questions stay low urgency."],
    faqs: ["What are your hours?", "Do you offer catering?", "Can I make a reservation?", "Where can I order online?"],
    recommendedCtas: ["Start order request", "Ask about catering", "Send message to manager"],
    commonObjections: ["I cannot find the menu", "I need a fast answer", "I had an issue with my order"],
    handoffTriggers: ["Refund request", "Food safety concern", "Catering lead", "Unhappy customer"],
  },
  {
    name: "Bakeries",
    categoryKeywords: ["bakery", "cake", "cupcake", "pastry"],
    leadQuestions: ["What baked item are you looking for?", "What date do you need it?", "How many people is it for?", "What is the best contact info?"],
    urgencyRules: ["Large orders and orders due within 72 hours get high urgency.", "General product questions stay low urgency."],
    faqs: ["Do you make custom cakes?", "How far ahead should I order?", "Do you offer gluten-free options?", "Can I request catering?"],
    recommendedCtas: ["Request custom order", "Ask about availability", "Send order details"],
    commonObjections: ["I need it quickly", "I am checking prices", "I need dietary details"],
    handoffTriggers: ["Allergy question", "Wedding or large event", "Order due soon", "Refund complaint"],
  },
  {
    name: "Dentists",
    categoryKeywords: ["dentist", "dental", "orthodont"],
    leadQuestions: ["Are you a new or existing patient?", "Is this urgent pain, routine care, or cosmetic care?", "What city are you in?", "What is the best contact info?"],
    urgencyRules: ["Pain, swelling, broken tooth, or urgent appointment requests get high urgency.", "Routine cleaning requests stay medium urgency."],
    faqs: ["Are you accepting new patients?", "Do you take my insurance?", "Can I request an appointment?", "What are your hours?"],
    recommendedCtas: ["Request appointment", "Ask for call back", "Send insurance question"],
    commonObjections: ["Do you take my insurance?", "I am nervous about dental care", "I need an appointment soon"],
    handoffTriggers: ["Medical emergency", "Severe pain", "Insurance-specific claim", "Protected health information"],
  },
  {
    name: "Med Spas",
    categoryKeywords: ["med spa", "spa", "botox", "aesthetic", "skin"],
    leadQuestions: ["What service are you interested in?", "Have you visited before?", "When would you like to come in?", "How should the team follow up?"],
    urgencyRules: ["Post-treatment concerns and medical questions get high urgency.", "General service questions stay medium urgency."],
    faqs: ["Do you offer consultations?", "What services are available?", "How do I book?", "Are there specials?"],
    recommendedCtas: ["Request consultation", "Ask about treatment", "Book follow-up"],
    commonObjections: ["I need pricing first", "I am not sure what treatment I need", "I am comparing providers"],
    handoffTriggers: ["Medical concern", "Side effect", "Complaint", "Price-sensitive package question"],
  },
  {
    name: "Auto Repair",
    categoryKeywords: ["auto", "mechanic", "repair", "tire", "brake"],
    leadQuestions: ["What is happening with the vehicle?", "What is the year, make, and model?", "Is the vehicle safe to drive?", "When do you need service?"],
    urgencyRules: ["Brake issues, no-start, overheating, or unsafe vehicle gets high urgency.", "Maintenance requests stay medium urgency."],
    faqs: ["Can I schedule service?", "Do you inspect brakes?", "Do you work on my vehicle type?", "Can I get an estimate?"],
    recommendedCtas: ["Request service", "Ask for estimate", "Schedule diagnosis"],
    commonObjections: ["I need a price before bringing it in", "I need it fixed quickly", "I am not sure what is wrong"],
    handoffTriggers: ["Tow needed", "Safety issue", "Warranty dispute", "Angry customer"],
  },
  {
    name: "Real Estate",
    categoryKeywords: ["real estate", "realtor", "agent", "home buyer", "home seller"],
    leadQuestions: ["Are you buying, selling, or researching?", "What city or neighborhood?", "What timeline are you thinking?", "How should the agent reach you?"],
    urgencyRules: ["Ready-to-list, active buyer, or showing request gets high urgency.", "Research-only visitors stay medium or low urgency."],
    faqs: ["What is my home worth?", "Can I schedule a showing?", "What areas do you serve?", "How do I start selling?"],
    recommendedCtas: ["Request home value", "Ask for showing", "Talk to agent"],
    commonObjections: ["I am just looking", "I do not want to be pressured", "I need to know value first"],
    handoffTriggers: ["Showing request", "Pre-approved buyer", "Listing lead", "Legal/financial advice request"],
  },
  {
    name: "Local Contractors",
    categoryKeywords: ["contractor", "remodel", "construction", "home service", "service"],
    leadQuestions: ["What project do you need help with?", "What city is the property in?", "When do you want to start?", "What is the best phone or email?"],
    urgencyRules: ["Damage, safety concerns, and near-term project deadlines get high urgency.", "General estimate requests stay medium urgency."],
    faqs: ["Do you offer estimates?", "What areas do you serve?", "How soon can someone call?", "Can I send project photos?"],
    recommendedCtas: ["Request estimate", "Send project details", "Ask for callback"],
    commonObjections: ["I need ballpark pricing", "I am comparing contractors", "I do not know where to start"],
    handoffTriggers: ["Safety concern", "Insurance claim", "Large project", "Legal or permit-specific request"],
  },
  {
    name: "Political Campaigns",
    categoryKeywords: ["campaign", "candidate", "political", "election"],
    leadQuestions: ["What race or campaign are you asking about?", "What geography matters?", "What timeline are you working toward?", "Who should HomeReach contact?"],
    urgencyRules: ["Election deadline, proposal request, or campaign manager inquiry gets high urgency.", "General information requests stay medium urgency."],
    faqs: ["Can HomeReach build a mail plan?", "Can you estimate reach and cost?", "Can we review postcard options?", "How fast can a campaign launch?"],
    recommendedCtas: ["Request campaign plan", "Ask for proposal", "Talk to strategist"],
    commonObjections: ["We need numbers quickly", "We already have a mail vendor", "We need to see district coverage"],
    handoffTriggers: ["Candidate or campaign manager response", "Political compliance question", "Payment or proposal request", "Urgent election timeline"],
  },
];

export const aiWebAssistantAgents: AiWebAssistantAgent[] = [
  {
    name: "Front Desk Agent",
    role: "Answers approved FAQs, hours, services, areas served, and simple next-step questions.",
    allowedActions: ["Answer approved FAQs", "Collect visitor context", "Summarize the conversation"],
    approvalRequiredFor: ["Pricing promises", "Policy exceptions", "Sensitive claims"],
  },
  {
    name: "Lead Capture Agent",
    role: "Collects name, phone, email, service need, location, urgency, and preferred contact method.",
    allowedActions: ["Capture lead details", "Qualify urgency", "Create internal lead record"],
    approvalRequiredFor: ["Outbound texts or emails", "Payment links", "Discounts"],
  },
  {
    name: "Routing Agent",
    role: "Routes conversations based on service type, urgency, business hours, and owner rules.",
    allowedActions: ["Flag urgent leads", "Recommend owner assignment", "Create follow-up tasks"],
    approvalRequiredFor: ["Confirming appointments", "External notifications if not enabled"],
  },
  {
    name: "Reputation Agent",
    role: "Identifies happy customers and supports review request workflows.",
    allowedActions: ["Suggest review request timing", "Draft review request copy"],
    approvalRequiredFor: ["Sending review requests", "Posting public replies"],
  },
  {
    name: "Local SEO Insight Agent",
    role: "Turns repeated customer questions into FAQ, service page, city page, and Google post ideas.",
    allowedActions: ["Identify question patterns", "Draft content recommendations"],
    approvalRequiredFor: ["Publishing website or Google profile content"],
  },
  {
    name: "Follow-Up Agent",
    role: "Creates follow-up reminders, drafts SMS/email replies, and alerts the owner when a lead needs attention.",
    allowedActions: ["Draft replies", "Recommend next action", "Summarize lead status"],
    approvalRequiredFor: ["Sending any outbound message"],
  },
];

export function getAssistantTemplate(category: string) {
  const normalized = category.toLowerCase();
  return (
    aiWebAssistantTemplates.find((template) =>
      template.categoryKeywords.some((keyword) => normalized.includes(keyword)),
    ) ?? aiWebAssistantTemplates.find((template) => template.name === "Local Contractors")!
  );
}

export function generateAiWebAssistantProfile(
  input: AiWebAssistantSetupInput,
  options: { embedKey?: string; baseUrl?: string } = {},
): AiWebAssistantProfile {
  const template = getAssistantTemplate(input.category);
  const serviceList = input.mainServices.length > 0 ? input.mainServices : template.recommendedCtas.map((cta) => cta.replace("Request ", ""));
  const serviceAreas = input.serviceAreas.length > 0 ? input.serviceAreas : ["Your service area"];
  const embedKey = options.embedKey ?? `demo_${slugify(input.businessName).slice(0, 36) || "assistant"}`;
  const baseUrl = options.baseUrl ?? "https://www.home-reach.com";
  const hoursText = input.hours || "Business hours can be added during setup";
  const contactText = input.contactPreference || "Have the team follow up by phone or email";

  return {
    assistantName: `${input.businessName || "Your Business"} AI Front Desk`,
    greeting: `Hi, I am the AI assistant for ${input.businessName || "this business"}. I can answer quick questions, collect what you need, and make sure the right person follows up.`,
    tone: "Helpful, calm, local, direct, and never pushy.",
    serviceList,
    serviceAreas,
    basicFaq: [
      `Hours: ${hoursText}.`,
      `Service areas: ${serviceAreas.join(", ")}.`,
      `Main services: ${serviceList.join(", ")}.`,
      `Best next step: ${input.bookingPreference || contactText}.`,
      ...template.faqs.slice(0, 4),
    ],
    leadQualificationFlow: [
      ...template.leadQuestions,
      "What is your name?",
      "What phone number or email should the team use?",
      "What is the best time to follow up?",
    ],
    escalationRules: template.urgencyRules,
    restrictedTopics: [
      "Do not promise exact pricing unless the business has approved published pricing.",
      "Do not confirm appointments unless calendar integration rules are active.",
      "Do not provide legal, medical, financial, or sensitive advice.",
      "Do not change listings, public profiles, refunds, discounts, or policies.",
      "When uncertain, capture contact information and alert the business owner.",
    ],
    handoffRules: template.handoffTriggers,
    reviewWorkflow:
      "If a visitor sounds happy after a completed service, draft a review request for owner approval instead of sending automatically.",
    localSeoInsight:
      "Repeated customer questions are logged as FAQ, service page, city page, and Google Business Profile post opportunities.",
    embedKey,
    embedCode: `<script src="${baseUrl}/api/ai-web-assistant/widget.js" data-assistant-key="${embedKey}" async></script>`,
    setupChecklist: [
      "Confirm business services, areas, and hours.",
      "Approve greeting, tone, FAQs, and restricted topics.",
      "Review urgency and handoff rules.",
      "Install embed code on the website.",
      "Run a test conversation before turning on live lead capture.",
    ],
    previewConversation: [
      { speaker: "assistant", text: `Hi, I am the AI assistant for ${input.businessName || "this business"}. What can I help you with today?` },
      { speaker: "visitor", text: `I need help with ${serviceList[0] ?? "a service"} in ${serviceAreas[0] ?? "my area"}.` },
      { speaker: "assistant", text: `I can help route that. Is this urgent, and what is the best phone or email for a follow-up?` },
      { speaker: "visitor", text: "Tomorrow is ideal. My phone number is available if someone can call me." },
      { speaker: "assistant", text: "Got it. I will summarize this for the team and ask them to follow up with the next step." },
    ],
  };
}

export function getAiWebAssistantSnapshot(): AiWebAssistantSnapshot {
  return {
    metrics: {
      conversationsHandled: 48,
      leadsCaptured: 17,
      conversionRate: "35%",
      afterHoursLeads: 6,
      unansweredQuestions: 4,
      followUpsNeeded: 5,
    },
    conversations: [
      {
        visitor: "New roofing lead",
        service: "Storm damage inspection",
        urgency: "high",
        status: "Follow-up needed",
        sourcePage: "/roofing",
        summary: "Visitor reported active leak after storm and wants a callback today.",
      },
      {
        visitor: "HVAC estimate request",
        service: "AC replacement estimate",
        urgency: "medium",
        status: "Qualified lead",
        sourcePage: "/services",
        summary: "Visitor asked about replacement timing and shared phone number for estimate.",
      },
      {
        visitor: "Happy customer",
        service: "Completed service review",
        urgency: "low",
        status: "Review request draft",
        sourcePage: "/contact",
        summary: "Visitor complimented the team. Review request draft is waiting for approval.",
      },
    ],
    leads: [
      {
        name: "Captured roofing lead",
        serviceNeed: "Leak repair",
        contact: "Phone captured",
        estimatedValue: "$750-$2,500",
        nextAction: "Call today",
      },
      {
        name: "Captured HVAC lead",
        serviceNeed: "Replacement quote",
        contact: "Email captured",
        estimatedValue: "$4,500-$9,000",
        nextAction: "Send estimate link",
      },
      {
        name: "Procurement inquiry",
        serviceNeed: "Supply cost review",
        contact: "Email captured",
        estimatedValue: "$599/mo",
        nextAction: "Invite to savings review",
      },
    ],
    actions: [
      {
        title: "Call high-urgency leak lead",
        detail: "The assistant captured a storm damage lead after hours. Same-day callback is recommended.",
        cta: "Open Lead",
        urgency: "high",
        status: "needs_review",
      },
      {
        title: "Approve FAQ update",
        detail: "Four visitors asked whether financing is available. Add an approved answer or route to staff.",
        cta: "Review FAQ",
        urgency: "medium",
        status: "draft_ready",
      },
      {
        title: "Approve review request draft",
        detail: "A happy customer conversation can become a review request once approved.",
        cta: "Review Draft",
        urgency: "medium",
        status: "draft_ready",
      },
    ],
    alerts: [
      {
        title: "Unanswered pricing question pattern",
        detail: "Visitors keep asking for starting price. Add approved pricing guidance or a safe callback script.",
        cta: "Add Guidance",
        urgency: "medium",
        status: "needs_review",
      },
      {
        title: "Urgent handoff rule missing",
        detail: "Emergency requests should route to a named owner before going live.",
        cta: "Set Owner",
        urgency: "high",
        status: "blocked",
      },
    ],
    agents: aiWebAssistantAgents,
    templates: aiWebAssistantTemplates,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
