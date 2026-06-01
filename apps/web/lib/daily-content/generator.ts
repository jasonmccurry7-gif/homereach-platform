import type {
  DailyContentGenerationContext,
  DailyVideoDraft,
  DailyVideoPlatform,
  DailyVideoVertical,
  LogoOutroSpec,
  RepurposedContentAsset,
  StoryboardScene,
} from "./types";
import { REVENUE_REEL_BLUEPRINT_VERSION } from "./revenue-reel-blueprints";

const PLATFORMS: DailyVideoPlatform[] = [
  "facebook_reels",
  "instagram_reels",
  "tiktok",
  "youtube_shorts",
];

const platformLabels: Record<DailyVideoPlatform, string> = {
  facebook_reels: "Facebook Reels",
  instagram_reels: "Instagram Reels",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube_shorts: "YouTube Shorts",
};

const CREATIVE_SYSTEM_VERSION = "offer-led-direct-response-v9-neighborhood-reactivation";
const TARGET_RUNTIME_SECONDS = "20-30";
const PROVIDER_RAW_FOOTAGE_SECONDS = "10";

export const HOMEREACH_3D_LOGO_OUTRO: LogoOutroSpec = {
  name: "HomeReach Premium 3D Logo Outro",
  durationSeconds: 4,
  format: "vertical_9_16",
  visualStyle:
    "Brushed metallic HomeReach logo resting flat like a coin on a dark matte table, realistic reflections, controlled cinematic shadows, and a premium local-growth finish.",
  animation: [
    "Start with a low camera angle across a dark surface as the logo sits still.",
    "Begin a slow clockwise rotation with subtle reflection movement across the brushed metal.",
    "Increase spin speed for one second with restrained motion blur.",
    "Ease the spin into a clean stop while a narrow light sweep crosses the logo.",
    "Camera pushes in slightly and settles on the final brand frame.",
  ],
  finalFrame: ["HomeReach", "Route Density Made Simple."],
  ctaVariations: [
    "Comment MAP for a free route-density example.",
    "Send me a DM.",
    "Want more customers near your current jobs?",
    "Stop marketing everywhere.",
    "Own the neighborhoods you already work in.",
  ],
  audio: [
    "Subtle metallic spin start",
    "Clean cinematic whoosh",
    "Quiet bass impact on final lockup",
    "Modern motivational finish with no cheesy corporate sting",
  ],
  guardrails: [
    "No cartoon treatment",
    "No crypto-style neon glow",
    "No unsupported claims",
    "Keep the outro elegant, readable, and credible",
  ],
};

type ThemePack = {
  title: string;
  angle: string;
  hook: string;
  pain: string;
  proofVisual: string;
  dashboardVisual: string;
  benefit: string;
  cta: string;
  tone: string;
  thumbnail: string;
  hashtags: string[];
  industry: string;
  voiceStyle: string;
};

const supplyfyThemes: ThemePack[] = [
  {
    title: "Bakery Cash Stack Shock",
    angle:
      "A bakery owner pays a large stack of cash for ingredients, sees the Supplyfy dashboard compare vendors, then pays a smaller stack for the same order.",
    hook: "Same ingredients. Too much money.",
    pain:
      "A busy bakery owner is frustrated handing over a thick cash stack for flour, sugar, boxes, and ingredients while margins keep shrinking.",
    proofVisual:
      "Real bakery counter, supplier delivery, visible ingredient bags, owner counting a large cash stack with a shocked, frustrated expression.",
    dashboardVisual:
      "HomeReach-controlled Supplyfy dashboard overlay showing the same ingredient order compared across vendors, with the lower-cost option highlighted in green.",
    benefit:
      "The owner hands a smaller stack of cash to another supplier for the same amount of ingredients and looks relieved.",
    cta: "Comment SAVE for a free savings review.",
    tone: "Owner stress, hidden overspending, relief, earned-money pride",
    thumbnail: "Bakery owner holding two cash stacks with Supplyfy savings dashboard in the background.",
    hashtags: ["#Supplyfy", "#SmallBusiness", "#BakeryOwner", "#FoodCosts", "#SaveMoney"],
    industry: "bakeries",
    voiceStyle: "calm, trustworthy, financially intelligent small-business owner energy",
  },
  {
    title: "Supplier Cash Stack Savings",
    angle:
      "A bakery or restaurant owner pays a large cash stack to one supplier, checks Supplyfy, then pays a smaller cash stack for the same ingredients.",
    hook: "Still overpaying for supplies?",
    pain:
      "The owner is frustrated because the same ingredients keep costing more, but manually comparing suppliers takes too much time.",
    proofVisual:
      "Real bakery or restaurant counter with ingredient bags, supplier delivery, owner handing over a thick cash stack and looking frustrated.",
    dashboardVisual:
      "HomeReach-controlled Supplyfy dashboard overlay with clean comparison cards, abstract rows, green savings highlight, and no provider-rendered text.",
    benefit:
      "The owner pays a visibly smaller cash stack to another supplier for the same amount of ingredients and looks relieved.",
    cta: "Comment SAVE for a free savings review.",
    tone: "Financial pain, hidden overspending, relief, earned-money pride",
    thumbnail: "Business owner comparing a large cash stack to a smaller one beside a Supplyfy dashboard.",
    hashtags: ["#Supplyfy", "#RestaurantOwner", "#FoodBusiness", "#VendorPricing", "#ProfitMargins"],
    industry: "bakeries and restaurants",
    voiceStyle: "conversational, confident, direct-response but not overhyped",
  },
  {
    title: "Pizza Shop Price Creep",
    angle:
      "A pizza shop owner thinks sales are the problem, then discovers cheese, boxes, sauce, and paper goods are quietly leaking margin.",
    hook: "It was not a sales problem. It was a purchasing problem.",
    pain:
      "A pizza shop owner checks cheese invoices, delivery fees, and box costs while a busy kitchen keeps moving behind them.",
    proofVisual:
      "Pizza oven, cheese bags, branded boxes, receipts, owner comparing numbers by hand and looking overwhelmed.",
    dashboardVisual:
      "Supplyfy dashboard turns the same recurring items into a ranked savings list by monthly impact.",
    benefit:
      "The owner stops guessing and sees which supplier line items deserve attention first.",
    cta: "Comment SAVE for a free savings review.",
    tone: "Fast, relatable, practical, modern operator advantage",
    thumbnail: "Pizza owner beside a supplier invoice with a Supplyfy lower-price callout.",
    hashtags: ["#Supplyfy", "#PizzaShop", "#FoodCosts", "#LocalBusiness", "#Margins"],
    industry: "pizza shops",
    voiceStyle: "energetic, relatable, no-nonsense food business operator",
  },
  {
    title: "Coffee Shop Manual Pricing",
    angle:
      "A coffee shop owner stops checking supplier pricing by hand and uses Supplyfy to reveal better recurring purchase options.",
    hook: "Still checking supplier pricing by hand?",
    pain:
      "A cafe owner toggles between spreadsheets, invoices, texts, and supplier websites while trying to keep the morning rush moving.",
    proofVisual:
      "Coffee counter, milk crates, cups, beans, calculator, phone, laptop spreadsheet, owner rubbing forehead.",
    dashboardVisual:
      "Supplyfy organizes recurring supplies, supplier prices, and savings opportunities into one clean dashboard.",
    benefit:
      "The owner gets control without adding another complicated system to the day.",
    cta: "Comment INFO for a free savings review.",
    tone: "Simplicity, control, time relief, smart purchasing",
    thumbnail: "Coffee shop owner replacing a messy spreadsheet with a clean Supplyfy screen.",
    hashtags: ["#Supplyfy", "#CoffeeShop", "#Procurement", "#SmallBusinessTips", "#SaveTime"],
    industry: "coffee shops",
    voiceStyle: "warm, calm, modern, helpful",
  },
  {
    title: "First Five Free Supplyfy Setup",
    angle:
      "A food business sees Supplyfy turn chaotic supplier decisions into a simple free early-access savings review.",
    hook: "The first 5 businesses get Supplyfy completely FREE.",
    pain:
      "A local food business owner is buried in invoices, supplier messages, and rising ingredient costs with no simple way to compare.",
    proofVisual:
      "Fast montage of receipts, ingredient shelves, supplier handoff, and a real owner checking numbers on a phone.",
    dashboardVisual:
      "Supplyfy dashboard shows vendors, recurring items, savings opportunities, and simple review status.",
    benefit:
      "The business gets a practical supply-savings view without doing more work.",
    cta: "Comment SAVE to claim a free Supplyfy review.",
    tone: "Urgent, helpful, founding-member value, practical relief",
    thumbnail: "Supplyfy FREE early access badge over real food-business invoices.",
    hashtags: ["#Supplyfy", "#FreeBusinessTool", "#FoodBusiness", "#CostSavings", "#SmallBusinessOwner"],
    industry: "food businesses",
    voiceStyle: "friendly, confident, conversion-focused",
  },
];

const targetedMailThemes: ThemePack[] = [
  {
    title: "Neighborhood Reactivation Map",
    angle:
      "A completed home-service job becomes a neighborhood reactivation map: HomeReach highlights the customer address, maps surrounding homes, and sends postcards to the neighbors most likely to recognize the work.",
    hook: "One job. One neighborhood.",
    pain:
      "Home-service businesses leave a job with their best proof sitting on the street, then spend money chasing random leads across town.",
    proofVisual:
      "Real home-service crew finishing a clean suburban job while the homeowner's street, nearby homes, and mailboxes are visible.",
    dashboardVisual:
      "HomeReach-controlled neighborhood map overlay shows the completed customer address, surrounding homes, route circles, and postcard drops around the job.",
    benefit:
      "HomeReach turns the job into a neighbor-facing postcard plan so the next leads come from the same area instead of scattered across town.",
    cta: "Comment MAP for a free route example.",
    tone: "Neighborhood reactivation, local proof, route density, practical growth",
    thumbnail: "Aerial neighborhood map with one completed job lit up and surrounding homes highlighted in red-and-white route circles.",
    hashtags: ["#HomeReach", "#RouteDensity", "#NeighborhoodMarketing", "#DirectMail", "#HomeServiceMarketing"],
    industry: "home-service businesses",
    voiceStyle: "assertive, clear, contractor-friendly, direct-response local growth tone",
  },
  {
    title: "Lawncare Neighborhood Density",
    angle:
      "A lawn care company finishes one yard, then the camera zooms out to show neighbors around that job receiving the company's postcards.",
    hook: "Your next customers may live next door.",
    pain:
      "Local service businesses keep marketing too broadly instead of building density around the homes where their work is already visible.",
    proofVisual:
      "Real lawn care company mowing a clean suburban yard, branded shirt or truck, fresh lawn stripes, confident field-work energy.",
    dashboardVisual:
      "Smooth bird's-eye zoom-out over 500 nearby homes as business postcard icons land in neighbors' mailboxes around the original lawn.",
    benefit:
      "HomeReach builds route density around the job so the next customers are closer, warmer, and easier to reach.",
    cta: "Comment MAP for a free route example.",
    tone: "Momentum, neighborhood growth, practical local dominance",
    thumbnail: "Lawncare mower on one side, aerial neighborhood postcard delivery map on the other.",
    hashtags: ["#HomeReach", "#LawnCareMarketing", "#DirectMail", "#NeighborhoodMarketing", "#RouteDensity"],
    industry: "lawn care companies",
    voiceStyle: "assertive, high-energy, contractor-friendly local business tone",
  },
  {
    title: "Stop Driving Across Town",
    angle:
      "A contractor is tired of scattered jobs and fuel costs, then sees a neighborhood density map around current work.",
    hook: "Stop chasing scattered jobs.",
    pain:
      "The contractor starts with jobs spread all over the map, long drive times, fuel receipts, and no local concentration.",
    proofVisual:
      "Service truck in traffic, fuel pump close-up, scattered job pins across a city map, tired owner looking at the phone.",
    dashboardVisual:
      "HomeReach density map clusters postcard targeting around the contractor's recent jobs and best-service neighborhoods.",
    benefit:
      "More of the right homeowners see the business near the work already being done.",
    cta: "Comment MAP for a free route example.",
    tone: "Direct, practical, margin-aware, contractor momentum",
    thumbnail: "Contractor truck routes shrinking from scattered city pins into one tight neighborhood.",
    hashtags: ["#HomeReach", "#ContractorMarketing", "#LocalLeads", "#DirectMailMarketing", "#SmallBusiness"],
    industry: "contractors",
    voiceStyle: "practical, direct, contractor-friendly",
  },
  {
    title: "HomeReach Lawncare Route Density",
    angle:
      "HomeReach Lawncare mows one yard on a zero-turn mower, then the camera moves to a bird's-eye neighborhood view and a mail carrier delivers postcards into neighbors' mailboxes.",
    hook: "Want more jobs nearby?",
    pain:
      "The business is wasting money marketing too broadly and losing time driving between scattered jobs.",
    proofVisual:
      "Real HomeReach Lawncare operator mowing one clean suburban yard on a zero-turn mower with a plain unmarked service truck nearby.",
    dashboardVisual:
      "Bird's-eye view where neighboring homes and curbside mailboxes are visible, followed by a mail carrier placing blank green-and-white lawncare postcards into neighbors' mailboxes.",
    benefit:
      "The route becomes denser, the truck drives less, and the business gets more chances to win nearby customers.",
    cta: "Comment MAP for a free route example.",
    tone: "Route density, local visibility, shorter drive time, practical growth",
    thumbnail: "Zero-turn mower at one yard, aerial neighborhood view, and mail delivery into nearby mailboxes.",
    hashtags: ["#HomeReach", "#LawnCareMarketing", "#DirectMail", "#RouteDensity", "#LocalAdvertising"],
    industry: "lawn care companies",
    voiceStyle: "confident, energetic, clear",
  },
  {
    title: "Competitor Owns The Block",
    angle:
      "A business sees a competitor becoming familiar in the neighborhood and uses HomeReach to create a better route-density plan.",
    hook: "Your competitors are already targeting your neighborhoods.",
    pain:
      "A competitor truck, yard sign, and repeated local visibility make the business owner realize attention is being won block by block.",
    proofVisual:
      "Subtle competitor truck driving through a neighborhood, homeowner mailbox, local sign, owner noticing lost visibility.",
    dashboardVisual:
      "HomeReach route map and postcard plan turn one job into a neighborhood visibility sequence.",
    benefit:
      "HomeReach helps the business show up where trust is already easiest to build.",
    cta: "Comment MAP for a free route example.",
    tone: "Competitive, urgent, premium, action-oriented",
    thumbnail: "Competitor truck fading behind a HomeReach route-density postcard map.",
    hashtags: ["#HomeReach", "#LocalMarketing", "#HomeServices", "#GrowYourBusiness", "#PostcardMarketing"],
    industry: "home-service businesses",
    voiceStyle: "bold, growth-oriented, social-native",
  },
  {
    title: "First Five Free Growth Review",
    angle:
      "A local service business gets a free social media and SEO review before using targeted mail to build neighborhood density.",
    hook: "The first 5 businesses get a FREE growth review.",
    pain:
      "The owner has scattered social posts, weak local visibility, inconsistent reviews, and no clear neighborhood plan.",
    proofVisual:
      "Phone screen with local posts, service truck at a job, Google-style local presence visuals, homeowner mailbox.",
    dashboardVisual:
      "HomeReach review board shows social, SEO, and targeted mail opportunities linked to one local growth plan.",
    benefit:
      "The business gets a clear plan before spending more on broad marketing.",
    cta: "Comment MAP for a free review.",
    tone: "Helpful, urgent, local-business friendly, clear next step",
    thumbnail: "Free social + SEO review badge beside a HomeReach neighborhood map.",
    hashtags: ["#HomeReach", "#FreeReview", "#LocalSEO", "#SocialMediaMarketing", "#DirectMail"],
    industry: "local service businesses",
    voiceStyle: "friendly, confident, growth-focused",
  },
];

export function getContentDate(input?: string | Date) {
  const date = input ? new Date(input) : new Date();
  return date.toISOString().slice(0, 10);
}

type DailyVideoDraftOptions = {
  variationSeed?: string;
};

export function buildDailyVideoDrafts(
  contentDate = getContentDate(),
  context?: DailyContentGenerationContext,
  options: DailyVideoDraftOptions = {},
): DailyVideoDraft[] {
  const seed = options.variationSeed ? `${contentDate}:${options.variationSeed}` : contentDate;
  return [
    buildDraft("procurement", pickTheme(supplyfyThemes, seed, 0), contentDate, context, options),
    buildDraft("targeted_postcard", pickTheme(targetedMailThemes, seed, 1), contentDate, context, options),
  ];
}

function pickTheme(themes: ThemePack[], seed: string, offset: number) {
  const n = hashSeed(seed);
  return themes[(n + offset) % themes.length] ?? themes[0]!;
}

function hashSeed(value: string) {
  return value.split("").reduce((sum, item, index) => sum + item.charCodeAt(0) * (index + 1), 0);
}

function buildDraft(
  vertical: DailyVideoVertical,
  theme: ThemePack,
  contentDate: string,
  context?: DailyContentGenerationContext,
  options: DailyVideoDraftOptions = {},
): DailyVideoDraft {
  const verticalLabel = vertical === "procurement" ? "Supplyfy" : "HomeReach Targeted Mail";
  const brandName = vertical === "procurement" ? "Supplyfy" : "HomeReach";
  const storyboard = buildStoryboard(theme, vertical);
  const platformPosts = buildPlatformPosts(theme, vertical);
  const suggestedPostingTimes = buildPostingTimes(vertical);
  const voiceoverScript = storyboard.map((scene) => scene.voiceover).join(" ");
  const rawComparisonVisual = buildRawComparisonVisual(vertical);
  const fullScript = [
    theme.hook,
    theme.pain,
    `${brandName} makes the next action obvious: ${rawComparisonVisual.toLowerCase()}.`,
    theme.benefit,
    theme.cta,
  ].join("\n\n");
  const repurposedAssets = buildRepurposedAssets({
    theme,
    vertical,
    brandName,
    platformPosts,
    fullScript,
    voiceoverScript,
  });

  return {
    contentDate,
    vertical,
    title: `${verticalLabel}: ${theme.title}`,
    angle: theme.angle,
    videoHook: theme.hook,
    fullScript,
    voiceoverScript,
    primaryCta: theme.cta,
    emotionalTone: theme.tone,
    storyboard,
    canvaPrompt: buildCanvaPrompt(theme, vertical, storyboard),
    canvaFields: {
      video_title: `${verticalLabel}: ${theme.title}`,
      hook: theme.hook,
      cta: theme.cta,
      visual_1: theme.proofVisual,
      visual_2: rawComparisonVisual,
      benefit: theme.benefit,
      industry: theme.industry,
      brand: brandName,
      format: "Vertical 9:16 direct-response reel. Final target is 20-30 seconds with HomeReach-controlled English overlays; raw AI provider footage stays text-free.",
    },
    captions: storyboard.map((scene) => scene.caption),
    alternateHooks: buildAlternateHooks(theme, vertical, context),
    dashboardScreenshots: buildDashboardScreenshots(vertical),
    thumbnailConcept: theme.thumbnail,
    platformPosts,
    hashtags: theme.hashtags,
    suggestedMusicVibe: buildMusicVibe(vertical),
    aiImagePrompts: buildImagePrompts(theme, vertical),
    motionGraphics: buildMotionGraphics(vertical),
    cameraMovements: buildCameraMovements(vertical),
    transitionInstructions: buildTransitionInstructions(),
    emotionalGuidance: buildEmotionalGuidance(vertical),
    repurposedAssets,
    suggestedPostingTimes,
    engagementStrategy: buildEngagementStrategy(vertical),
    logoOutroSpec: vertical === "targeted_postcard" ? HOMEREACH_3D_LOGO_OUTRO : buildSupplyfyOutro(),
    manualPublishChecklist: buildManualPublishChecklist(),
    optimizationNotes: [
      "Judge the first three seconds by scroll-stopping clarity, not polish alone.",
      "Track comments, DMs, saves, shares, booked calls, and lead source by hook.",
      "Regenerate visuals if the human scene looks fake, any AI-rendered text appears, or the CTA is not obvious.",
      "Do not publish repetitive variants; keep only the strongest daily asset after review.",
    ],
    sourceContext: {
      engine: "HomeReach AI Reel Command Center",
      contentDate,
      vertical,
      dailyCadence: vertical === "procurement" ? "one Supplyfy reel per day" : "one HomeReach targeted mail reel per day",
      humanApprovalRequired: true,
      autoPublishEnabled: false,
      targetPlatforms: PLATFORMS,
      targetFormat: "vertical_9_16",
      creativeSystemVersion: CREATIVE_SYSTEM_VERSION,
      revenueReelBlueprintVersion: REVENUE_REEL_BLUEPRINT_VERSION,
      variationSeed: options.variationSeed ?? null,
      desiredRuntimeSeconds: TARGET_RUNTIME_SECONDS,
      providerRenderSeconds: PROVIDER_RAW_FOOTAGE_SECONDS,
      textPolicy: "AI provider raw footage must contain no visible text. HomeReach adds all English captions, CTA overlays, and final cards.",
      directResponseFormula: ["hook", "problem", "financial pain", "solution", "result", "CTA"],
      qualityChecklist: [
      "All visible text is controlled by HomeReach overlays, never by AI provider raw footage.",
      "Every overlay is English, spelled correctly, and fewer than 8 words.",
      "The service, financial pain, result, and CTA are obvious on mobile.",
      "Footage shows realistic humans and authentic business environments with no documents, screens, signage, labels, forms, menus, or readable surfaces.",
      "No AI gibberish, random graphics, or meaningless scenes are acceptable.",
      ],
      contextLoadedAt: context?.loadedAt ?? null,
      contextPolicy: "Only approved Content Intel and verified AI Assets are allowed to influence daily content generation.",
      approvedContentIntel: context?.contentIntel ?? [],
      approvedAiAssets: context?.aiOutputs ?? [],
      performanceSignals: context?.performanceSignals ?? [],
      repurposedAssets,
      organicToPaidPlan: buildOrganicToPaidPlan(theme, vertical),
    },
  };
}

function buildRepurposedAssets({
  theme,
  vertical,
  brandName,
  platformPosts,
  fullScript,
  voiceoverScript,
}: {
  theme: ThemePack;
  vertical: DailyVideoVertical;
  brandName: string;
  platformPosts: Record<DailyVideoPlatform, string>;
  fullScript: string;
  voiceoverScript: string;
}): RepurposedContentAsset[] {
  const offer = vertical === "procurement"
    ? "free savings review"
    : "free route-density example";
  const buyer = vertical === "procurement"
    ? theme.industry
    : theme.industry;
  const practicalTip = vertical === "procurement"
    ? "Start by checking the recurring items you buy every week. The hidden savings are usually in the repeat orders, not the one-off purchases."
    : "Start with the jobs or customers you already have. The best nearby prospects often live around your current proof.";

  return [
    {
      channel: "facebook_post",
      label: "Facebook Post",
      copy: platformPosts.facebook_reels ?? `${theme.hook}\n\n${theme.benefit}\n\n${theme.cta}`,
      recommendedUse: "Post as the native caption after the reel is reviewed.",
      approvalRequired: true,
      humanAction: "Review, edit for the day, then publish manually.",
    },
    {
      channel: "facebook_group_post",
      label: "Facebook Group Post",
      copy: `${theme.hook}\n\nA practical thing for ${buyer}: ${practicalTip}\n\nI am working on this locally and can send a quick example if it would help.`,
      recommendedUse: "Use only in groups where you are authorized to participate and the post is genuinely helpful.",
      approvalRequired: true,
      humanAction: "Edit for the specific group and copy manually. Do not auto-post.",
    },
    {
      channel: "email",
      label: "Email",
      copy: `Subject: ${theme.hook}\n\nHi [Name],\n\n${theme.pain}\n\n${brandName} helps make the next step clearer: ${theme.benefit.toLowerCase()}\n\nWould it be helpful if I sent over a quick ${offer}?\n\nJason`,
      recommendedUse: "Use as an approval-gated one-to-one email draft.",
      approvalRequired: true,
      humanAction: "Personalize sender, recipient, proof, and CTA before sending.",
    },
    {
      channel: "sms",
      label: "SMS",
      copy: `Hi [Name], this is Jason with HomeReach. ${theme.hook} I can send a quick ${offer} if useful. Reply STOP to opt out.`,
      recommendedUse: "Use only for contacts with proper SMS permission and approved A2P/compliance status.",
      approvalRequired: true,
      humanAction: "Confirm opt-in and approval before sending.",
    },
    {
      channel: "dm",
      label: "DM",
      copy: `Saw your business and thought this might be useful: ${theme.hook} I can send a quick example of how I would approach it locally if helpful.`,
      recommendedUse: "Use as a short manual DM draft after context is reviewed.",
      approvalRequired: true,
      humanAction: "Personalize to the source thread or business before copying.",
    },
    {
      channel: "ad_concept",
      label: "Ad Concept",
      copy: `Hook: ${theme.hook}\nAudience: ${buyer}\nPrimary text: ${theme.pain}\nCreative: ${theme.thumbnail}\nCTA: ${theme.cta}`,
      recommendedUse: "Use only as a human-approved paid-test starting point when organic performance earns it.",
      approvalRequired: true,
      humanAction: "Approve budget, audience, claim support, and destination before launching.",
    },
    {
      channel: "short_form_video_script",
      label: "Short Form Video Script",
      copy: voiceoverScript || fullScript,
      recommendedUse: "Reuse as a voiceover, reel, or Shorts draft.",
      approvalRequired: true,
      humanAction: "Review claims, visuals, and final caption before export.",
    },
    {
      channel: "landing_page_section",
      label: "Landing Page Section",
      copy: `## ${theme.hook}\n\n${theme.pain}\n\n${theme.benefit}\n\nPrimary CTA: ${theme.cta}`,
      recommendedUse: "Use as a draft section for a service, city, or campaign page.",
      approvalRequired: true,
      humanAction: "Review SEO fit, proof support, and page destination before publishing.",
    },
  ];
}

function buildOrganicToPaidPlan(theme: ThemePack, vertical: DailyVideoVertical) {
  return {
    enabledOnlyAfterHumanApproval: true,
    recommendationTrigger: "Only test paid spend after organic metrics beat baseline or create leads, DMs, saves, shares, or replies.",
    audienceSuggestion: vertical === "procurement"
      ? `${theme.industry} owners and operators in active service areas`
      : `${theme.industry} in selected neighborhoods, cities, or route-density service areas`,
    budgetSuggestion: "$10-$25/day for a short proof-of-signal test after approval.",
    ctaSuggestion: theme.cta,
    safety: [
      "Do not launch ads automatically.",
      "Confirm claims, audience, destination, and budget before spend.",
      "Use organic winner metrics as the reason for the paid test.",
    ],
  };
}

function buildStoryboard(theme: ThemePack, vertical: DailyVideoVertical): StoryboardScene[] {
  if (vertical === "procurement") {
    return [
      {
        time: "0:00-0:03",
        visual: theme.proofVisual,
        caption: shortSupplyfyHook(theme.hook),
        motion: "Fast punch-in on the owner's face, the cash or invoice, and the supplier handoff.",
        voiceover: `${shortSupplyfyHook(theme.hook)} Most owners feel the cost pressure before they can see where it is coming from.`,
      },
      {
        time: "0:03-0:08",
        visual: "Business owner counting a large cash stack beside plain ingredient containers and looking frustrated about rising supply costs.",
        caption: "Prices keep increasing.",
        motion: "Quick cuts between the cash stack, plain ingredient containers, supplier handoff, and the owner's concerned reaction.",
        voiceover: "Prices keep increasing, and most businesses do not have time to compare every recurring supply order.",
      },
      {
        time: "0:08-0:13",
        visual: "Controlled Supplyfy dashboard overlay shows the same recurring ingredients compared across vendors, then cuts to a high-cost cash stack beside a lower-cost green stack.",
        caption: "Compare vendors instantly.",
        motion: "Cut from the large cash stack into the dashboard overlay, then match-cut into a simple red-to-green savings contrast.",
        voiceover: "Supplyfy compares vendors and identifies savings opportunities automatically.",
      },
      {
        time: "0:13-0:20",
        visual: theme.benefit,
        caption: "Keep more profit.",
        motion: "Match cut from the large payment to a smaller payment, then the owner smiles with visible relief.",
        voiceover: "The result is simple: keep more of the money you already worked for.",
      },
      {
        time: "0:20-0:25",
        visual: "Clean Supplyfy and HomeReach end frame created by the overlay layer, with no AI-generated text in the raw video.",
        caption: "Comment SAVE",
        motion: "Hold long enough for the CTA to be readable, with subtle green savings accent and low-volume inspirational music.",
        voiceover: "Comment SAVE or send me a DM for a free savings review.",
      },
    ];
  }

  return [
    {
      time: "0:00-0:03",
      visual: theme.proofVisual,
      caption: shortTargetedMailHook(theme.hook),
      motion: "Open on a completed job or active service work, then immediately frame the surrounding street as the opportunity.",
      voiceover: `${shortTargetedMailHook(theme.hook)} Your best next customers may already live on that same street.`,
    },
    {
      time: "0:03-0:08",
      visual: "Aerial neighborhood map overlay highlights the customer home first, then marks nearby homes in a tight ring around the job.",
      caption: "Your proof is local.",
      motion: "Desaturate the neighborhood, spotlight the completed job, then animate route circles around nearby homes.",
      voiceover: "The job you just finished is local proof. The neighbors can see the work, the truck, and the result.",
    },
    {
      time: "0:08-0:14",
      visual: "HomeReach route-density map turns the nearby homes into postcard targets, with clean markers landing on mailboxes around the customer address.",
      caption: "Mail the neighbors next.",
      motion: "Animate postcard markers from the customer address outward to surrounding mailboxes, like a neighborhood reactivation map.",
      voiceover: "HomeReach maps the surrounding homes and gets your postcard in front of the neighbors next.",
    },
    {
      time: "0:14-0:20",
      visual: "Scattered city marketing collapses into a denser neighborhood route cluster with nearby homes, shorter drive paths, and a simple service-area plan.",
      caption: "Build route density.",
      motion: "Show scattered dots fading out while a tight cluster around the completed job gets brighter.",
      voiceover: "Instead of chasing scattered leads across town, you build route density where trust is already easier.",
    },
    {
      time: "0:20-0:25",
      visual: "Crisp 3D HomeReach logo on a dark premium background created by the overlay layer.",
      caption: "Comment MAP",
      motion: "3D logo lockup with restrained light sweep, then hold for the comment CTA.",
      voiceover: "Route Density Made Simple. Comment MAP or send me a DM for a free route-density example.",
    },
  ];
}

function buildRawComparisonVisual(vertical: DailyVideoVertical) {
  return vertical === "procurement"
    ? "A textless red-to-green supplier comparison using cash stacks, unmarked crates, and plain ingredient containers."
    : "A controlled neighborhood reactivation map showing one completed job, nearby homes, postcard drops, and a tighter route cluster.";
}

function shortSupplyfyHook(hook: string) {
  if (isShortOverlayText(hook)) return hook;
  return "Still overpaying for supplies?";
}

function shortTargetedMailHook(hook: string) {
  if (isShortOverlayText(hook)) return hook;
  return "Want nearby jobs?";
}

function isShortOverlayText(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length < 8 && value.length <= 42;
}

function buildCanvaPrompt(theme: ThemePack, vertical: DailyVideoVertical, storyboard: StoryboardScene[]) {
  const isSupplyfy = vertical === "procurement";
  const brandName = isSupplyfy ? "Supplyfy" : "HomeReach";
  const offer = isSupplyfy
    ? "The first 5 businesses get Supplyfy completely FREE."
    : "Comment MAP for a free route-density example around one recent job address. The first 5 businesses also get a free social media plus SEO review and improvement plan.";

  return [
    `Create a premium vertical 9:16 short real-life reel for ${brandName}.`,
    "This is a direct-response social video, not a corporate explainer. It must feel like a high-performing modern paid ad and authentic business-owner content.",
    "Final reel target: 20-30 seconds. Current AI provider raw footage target: 10 seconds. HomeReach adds the controlled English caption and CTA overlays after render.",
    "First 3 seconds: must stop the scroll with a realistic visual hook and emotional business pain.",
    "Audio: cool motivational music that creates momentum and inspires comments or DMs. Music must never overpower the voiceover.",
    `Voice: natural English, ${theme.voiceStyle}.`,
    "Language: English voiceover only. Do not ask the AI video provider to render any visible text; all visible words must be added later by the HomeReach overlay/export layer.",
    "Overlay copy must be English, spelled correctly, mobile-readable, and fewer than 8 words per scene.",
    "Visual style: realistic people, realistic hands, authentic local business environments, natural lighting, believable owner emotion, fast social-native pacing.",
    "Critical raw-footage rule: no documents, receipts, invoices, laptops, tablets, phones, dashboards, forms, menus, signs, labels, packaging text, shirt text, truck lettering, charts, tables, or readable surfaces.",
    "Avoid futuristic effects, generic AI animation, random graphics, stock-footage energy, fake dashboards, or any background signage.",
    `Offer to remember: ${offer}`,
    `Core hook: ${theme.hook}`,
    `Emotional tone: ${theme.tone}`,
    `Thumbnail direction: ${theme.thumbnail}`,
    "Storyboard:",
    ...storyboard.map((scene) => `${scene.time}: ${scene.visual} Caption: ${scene.caption} Motion: ${scene.motion}`),
    isSupplyfy
      ? "Final overlay text: You deserve the money you work for. Supply savings done for you."
      : "Final overlay text: HomeReach. Route Density Made Simple.",
    "Quality control before approval: English only, no misspellings, no AI gibberish, realistic humans, clear financial pain, clear solution, obvious result, and a direct comment/DM CTA.",
    "Avoid: generic SaaS demo, obvious AI stock footage, distorted hands, fake-looking faces, unreadable AI text, cartoon effects, aggressive EDM, cheesy corporate music, unsupported savings guarantees, spammy hype.",
  ].join("\n");
}

function buildPlatformPosts(theme: ThemePack, vertical: DailyVideoVertical): Record<DailyVideoPlatform, string> {
  const offer = vertical === "procurement"
    ? "The first 5 businesses get Supplyfy completely FREE."
    : "Comment MAP for a free route-density example around one recent job address. The first 5 businesses also get a free social media + SEO review and improvement plan.";
  const base = `${theme.hook}\n\n${theme.pain}\n\n${theme.benefit}\n\n${offer}\n\n${theme.cta}`;

  return {
    facebook_reels: `${base}\n\nComment "${vertical === "procurement" ? "SAVE" : "MAP"}" and we will show you the next step.`,
    instagram_reels: `${theme.hook}\n\n${theme.benefit}\n\n${theme.cta}`,
    tiktok: `${theme.hook}\n\n${theme.cta}`,
    linkedin: `${base}\n\nHuman approval required before public use.`,
    youtube_shorts: `${base}\n\nWant an example? Message HomeReach.`,
  };
}

function buildAlternateHooks(theme: ThemePack, vertical: DailyVideoVertical, context?: DailyContentGenerationContext) {
  const learnedPatterns = (context?.performanceSignals ?? [])
    .filter((signal) => signal.title === "Winning pattern")
    .map((signal) => signal.summary)
    .filter((summary) => summary.length > 0 && summary.length <= 120)
    .slice(0, 3);
  if (vertical === "procurement") {
    return uniqueList([
      "Most small businesses are overpaying every single week.",
      "Still checking supplier pricing by hand?",
      "Your vendors may be hoping you never compare this.",
      "You may not need more sales. You may need fewer hidden costs.",
      theme.hook,
      ...learnedPatterns,
    ]);
  }

  return uniqueList([
    "One completed job should create the next neighborhood.",
    "Your best proof is already sitting on that street.",
    "Stop mailing random homes. Mail around your work.",
    "Comment MAP if you want your free density example.",
    theme.hook,
    ...learnedPatterns,
  ]);
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildDashboardScreenshots(vertical: DailyVideoVertical) {
  if (vertical === "procurement") {
    return [
      "/operations-copilot supplier comparison",
      "/operations-copilot savings rollup",
      "/admin/procurement recurring supplies",
    ];
  }

  return [
    "/targeted campaign builder route view",
    "/admin/targeted-campaigns route-density plan",
    "/targeted neighborhood postcard preview",
  ];
}

function buildImagePrompts(theme: ThemePack, vertical: DailyVideoVertical) {
  if (vertical === "procurement") {
    return [
      `Real ${theme.industry} owner reviewing supplier invoices and cash payments, cinematic realistic lighting, authentic emotion, no stock-photo feel.`,
      "Textless visual comparison of a large red cost stack beside a smaller green savings stack, no screens, no paper, no labels.",
      "Premium HomeReach and Supplyfy final brand-card background, dark navy with green savings accent, text added only by overlay layer.",
    ];
  }

  return [
    `Real ${theme.industry} finishing a suburban job, cinematic realistic lighting, visible street context, nearby homes, and believable local operator energy.`,
    "Aerial neighborhood reactivation map with one completed job highlighted, surrounding homes marked, postcard drops, and clean route-density rings.",
    "3D HomeReach logo final-card background on a dark premium surface with Route Density Made Simple added by the overlay layer.",
  ];
}

function buildMotionGraphics(vertical: DailyVideoVertical) {
  if (vertical === "procurement") {
    return [
      "Green savings highlight appears only after the owner sees the lower-cost supplier option.",
      "One clean textless supplier comparison moment, no cluttered table.",
      "Small cash-stack contrast animation from large payment to smaller payment.",
      "Final HomeReach + Supplyfy end card with calm green accent.",
    ];
  }

  return [
    "Desaturate the neighborhood and spotlight the completed job as the proof point.",
    "Red-and-white route circles expand from the customer address to nearby homes.",
    "Postcard markers land on surrounding homes and mailboxes in a tight service cluster.",
    "Scattered city dots collapse into one dense neighborhood route plan.",
    "Final HomeReach 3D logo lockup with Route Density Made Simple.",
  ];
}

function buildCameraMovements(vertical: DailyVideoVertical) {
  if (vertical === "procurement") {
    return [
      "Fast push-in on cash in the first second.",
      "Reaction close-up on owner realizing the overspending.",
      "Clean insert shot of the textless red-to-green supplier comparison.",
      "Match cut from large supplier payment to smaller payment.",
    ];
  }

  return [
    "Fast hook shot at the completed job, then a hard zoom-out to the neighborhood.",
    "Overhead push across the street as the customer home becomes the center point.",
    "Controlled map movement as route circles and postcard markers activate nearby homes.",
    "Slow premium push-in on final 3D HomeReach logo.",
  ];
}

function buildTransitionInstructions() {
  return [
    "Use fast match cuts between pain and solution.",
    "Keep HomeReach overlay captions large, short, English, and readable on mobile.",
    "Keep every visible text scene under 8 words.",
    "Never approve provider-rendered foreign text, pseudo-text, or misspellings.",
    "Reject any raw provider footage containing documents, screens, menus, labels, signs, shirts, trucks, or packaging with text.",
    "Avoid over-complex animations that make the video feel fake.",
    "End with a clean CTA and enough time to read it.",
  ];
}

function buildSupplyfyOutro(): LogoOutroSpec {
  return {
    ...HOMEREACH_3D_LOGO_OUTRO,
    name: "HomeReach + Supplyfy Savings Outro",
    visualStyle:
      "Premium HomeReach and Supplyfy lockup on a dark navy background with white text and restrained green savings accents.",
    finalFrame: ["Supplyfy", "Supply savings done for you."],
    ctaVariations: [
      "Comment SAVE.",
      "Send me a DM.",
      "Want to see your possible savings?",
      "The first 5 businesses get Supplyfy completely FREE.",
    ],
  };
}

function buildMusicVibe(vertical: DailyVideoVertical) {
  if (vertical === "procurement") {
    return "Modern subtle motivational beat, smooth upbeat pulse, premium tech feel, emotional but not cheesy, no distracting vocals.";
  }
  return "Energetic local-business growth beat, confident momentum, clean percussion, bold but not aggressive, no overpowering vocals.";
}

function buildEmotionalGuidance(vertical: DailyVideoVertical) {
  if (vertical === "procurement") {
    return "Make the owner feel the frustration of hidden overspending first, then the relief of finally seeing a simple way to protect margin.";
  }
  return "Make the service business feel that growth can be closer, denser, and less random when marketing follows the neighborhoods where work is already happening.";
}

function buildPostingTimes(vertical: DailyVideoVertical): Record<DailyVideoPlatform, string> {
  const base: Record<DailyVideoPlatform, string> = {
    facebook_reels: "10:45 AM local",
    instagram_reels: "12:15 PM local",
    tiktok: "6:45 PM local",
    linkedin: "8:10 AM local",
    youtube_shorts: "5:30 PM local",
  };
  if (vertical === "targeted_postcard") {
    return { ...base, facebook_reels: "7:15 PM local", instagram_reels: "6:20 PM local" };
  }
  return base;
}

function buildEngagementStrategy(vertical: DailyVideoVertical) {
  if (vertical === "procurement") {
    return [
      "Pin a comment asking owners to comment SAVE for a free Supplyfy review.",
      "Route DMs into procurement intake and request invoices only after human trust is established.",
      "Track comments mentioning vendors, food costs, suppliers, margins, price increases, and invoices.",
      "Do not promise guaranteed savings; frame analysis as a review and opportunity scan.",
    ];
  }

  return [
      "Pin a comment asking service businesses to comment MAP for a free route-density example.",
      "Route DMs into targeted campaign consults and capture city, trade, and current service area.",
      "Track comments mentioning drive time, local leads, postcards, neighborhood, routes, and competitors.",
      "Offer the free social media + SEO review only as a human-reviewed next step.",
  ];
}

function buildManualPublishChecklist() {
  return [
    "Watch the rendered AI b-roll MP4 in full before approving.",
    "Confirm raw footage has no visible AI-generated text, foreign text, or gibberish.",
    "Confirm all HomeReach overlay captions and final-card text are readable English.",
    "Confirm every text scene is spelled correctly and fewer than 8 words.",
    "Confirm the reel clearly shows the problem, financial pain, solution, result, and CTA.",
    "Confirm humans, hands, businesses, comparison visuals, homes, and service scenes look realistic.",
    "Confirm no unsupported ROI, savings, ranking, or delivery guarantee is made.",
    "Confirm the CTA matches the selected offer: SAVE/INFO for Supplyfy or MAP for HomeReach.",
    "Copy platform caption and hashtags.",
    "Publish or schedule manually on the selected platform after approval.",
    "Paste the live post URL back into HomeReach for tracking.",
  ];
}

export function platformList() {
  return PLATFORMS.map((platform) => ({ platform, label: platformLabels[platform] }));
}
