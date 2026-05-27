import type { OutreachCategory, OutreachPriority } from "./types";

export const DAILY_OUTREACH_TARGETS: Record<OutreachCategory, number> = {
  "Targeted Campaign": 5,
  "Procurement / Supplify": 3,
  "Political Outreach": 3,
  "Government Contracting": 1,
};

export const OUTREACH_CATEGORIES = Object.keys(
  DAILY_OUTREACH_TARGETS
) as OutreachCategory[];

type DraftInput = {
  category: OutreachCategory;
  businessName?: string | null;
  campaignName?: string | null;
  contactName?: string | null;
  industry?: string | null;
};

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? null;
}

function displayName(input: DraftInput) {
  return input.businessName || input.campaignName || "your organization";
}

export function normalizePriority(value?: string | null): OutreachPriority {
  if (value === "urgent" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

export function suggestedActionType(category: OutreachCategory, hasEmail: boolean, hasPhone: boolean) {
  if (category === "Government Contracting") return "review_opportunity";
  if (hasEmail) return "email";
  if (hasPhone) return "sms";
  return "facebook_dm";
}

export function buildOutreachDrafts(input: DraftInput) {
  const name = displayName(input);
  const first = firstName(input.contactName);
  const greeting = first ? `Hi ${first},` : "Hi,";
  const industry = input.industry || "your work";

  if (input.category === "Procurement / Supplify") {
    return {
      emailSubject: `Quick supply savings review for ${name}`,
      emailBody: `${greeting}

I am reaching out from HomeReach because we help local operators find hidden supply and operational savings without adding another complicated system.

For ${name}, the first step would be simple: a quick review of recurring supply categories, vendor pressure points, and where margin may be leaking.

Would it be worth a short conversation this week to see if there is anything obvious to tighten up?`,
      smsBody: `${first ? `Hi ${first}` : "Hi"}, HomeReach helps local businesses spot supply cost leaks and vendor savings opportunities. Open to a quick review for ${name}? Reply STOP to opt out.`,
      dmBody: `${first ? `Hi ${first}` : "Hi"} - I am with HomeReach. We help local businesses find supply and operating cost savings without making the owner chase spreadsheets. Would a quick review be useful for ${name}?`,
    };
  }

  if (input.category === "Political Outreach") {
    return {
      emailSubject: `Campaign mail execution support for ${name}`,
      emailBody: `${greeting}

I am reaching out from HomeReach. We help campaigns plan and execute disciplined direct-mail programs with clear logistics, timelines, route visibility, and production control.

No voter profiling or black-box targeting. The focus is geography, timing, cost, creative readiness, and getting mail executed cleanly.

Would it be useful to compare what you have planned against a fast mail execution timeline?`,
      smsBody: `${first ? `Hi ${first}` : "Hi"}, HomeReach supports campaign mail execution: geography, timing, cost, and logistics. Open to a quick planning conversation? Reply STOP to opt out.`,
      dmBody: `${first ? `Hi ${first}` : "Hi"} - HomeReach helps campaigns execute mail with clearer logistics, timelines, and route planning. Would a quick planning conversation be useful?`,
    };
  }

  if (input.category === "Government Contracting") {
    return {
      emailSubject: `Bid/no-bid review item for ${name}`,
      emailBody: `${greeting}

HomeReach is reviewing government contracting opportunities through a human-approved bid/no-bid process.

The immediate action is to confirm fit, deadline, required documents, subcontractor needs, and whether the opportunity is operationally realistic.

Next step: review requirements and decide whether this should move into bid prep.`,
      smsBody: `Government contracting review: confirm fit, deadline, required docs, subcontractor needs, and bid/no-bid next action for ${name}.`,
      dmBody: `Government contracting review needed for ${name}: deadline, fit, required docs, subcontractor needs, and bid/no-bid next action.`,
    };
  }

  return {
    emailSubject: `Targeted neighborhood campaign for ${name}`,
    emailBody: `${greeting}

I am reaching out from HomeReach. We help local service businesses get in front of the exact neighborhoods around recent jobs and high-fit local routes.

For a ${industry} business like ${name}, the idea is simple: make the next campaign more local, more visible, and easier to act on.

Would you be open to a quick look at what a targeted neighborhood campaign could look like?`,
    smsBody: `${first ? `Hi ${first}` : "Hi"}, HomeReach helps local businesses target nearby neighborhoods with postcard campaigns around real service areas. Open to a quick look for ${name}? Reply STOP to opt out.`,
    dmBody: `${first ? `Hi ${first}` : "Hi"} - I am with HomeReach. We help local businesses run targeted neighborhood postcard campaigns around high-fit service areas. Would you be open to seeing what that could look like for ${name}?`,
  };
}

export function buildSocialPosts(dateLabel: string) {
  return [
    {
      category: "Authority",
      post_type: "Main Facebook authority post",
      audience: "Local business owners",
      content: `Most local business owners do not need another dashboard. They need a clearer way to find margin, follow up faster, and stay visible in the neighborhoods that already trust local service providers.

That is the lane HomeReach is focused on: practical execution, better targeting, cleaner follow-up, and less operational drag.

If you own a local business and want a simple outside look at where growth or savings may be hiding, I am happy to compare notes.`,
      short_content: `Local businesses need clearer execution: better targeting, faster follow-up, and less operational drag. Happy to compare notes if you want a simple outside look.`,
    },
    {
      category: "Community",
      post_type: "Facebook group post",
      audience: "Local business group",
      content: `Question for local business owners: what is the one operating cost or recurring vendor category you wish you had more visibility into right now?

Supplies, marketing, delivery, printing, software, fuel, something else?

I am mapping the common pressure points local operators are dealing with this month and would genuinely like to hear what is showing up on the ground.`,
      short_content: `Local owners: what recurring cost do you wish you had more visibility into right now? Supplies, marketing, delivery, software, fuel, or something else?`,
    },
    {
      category: "Engagement",
      post_type: "Engagement question",
      audience: "Owners and operators",
      content: `What is harder right now: getting new customers, keeping margins healthy, or finding enough time to follow up with people who already showed interest?`,
      short_content: `What is hardest right now: new customers, healthy margins, or follow-up time?`,
    },
    {
      category: "Targeted Campaign",
      post_type: "Contractor-focused post",
      audience: "Contractors and home service businesses",
      content: `Contractors: when you finish a good job in a neighborhood, the next best opportunity is often nearby.

The play is not blasting everyone. It is staying visible around the streets where your work already creates trust.

That is where targeted neighborhood campaigns can be useful: simple geography, clear offer, consistent follow-up.`,
      short_content: `Contractors: after a good job, the next best opportunity is often nearby. Target the surrounding streets, stay visible, and keep the follow-up simple.`,
    },
    {
      category: "Procurement / Supplify",
      post_type: "Procurement-focused post",
      audience: "Restaurants, bakeries, and operators",
      content: `A lot of savings are not dramatic. They are hidden in repeat orders, vendor creep, delivery charges, substitutions, and categories nobody has had time to review.

For local operators, a small improvement in recurring costs can matter more than a flashy new tool.

That is why procurement visibility is becoming one of HomeReach's core priorities.`,
      short_content: `Savings often hide in repeat orders, vendor creep, delivery charges, and categories nobody has time to review. Small recurring wins matter.`,
    },
    {
      category: "Political Outreach",
      post_type: "Political outreach post optional",
      audience: "Campaign teams",
      content: `Campaign mail works best when the operational details are clear: geography, timing, print readiness, route coverage, cost, and approval flow.

HomeReach's political mail work is focused on disciplined execution, not vague targeting claims.`,
      short_content: `Campaign mail needs clear geography, timing, print readiness, route coverage, cost, and approvals. Discipline beats vague targeting claims.`,
    },
    {
      category: "Local",
      post_type: "Local community/business post",
      audience: "Local community",
      content: `Local businesses are carrying a lot right now: higher costs, tighter margins, more noise, and less time.

The businesses that keep winning usually have one thing in common: they make it easier for people nearby to remember them, trust them, and take the next step.`,
      short_content: `Local businesses are carrying higher costs, tighter margins, and more noise. The winners make it easier for nearby people to remember and trust them.`,
    },
  ].map((post) => ({ ...post, outreach_date: dateLabel }));
}

export function rewriteSocialContent(content: string, mode: "emotional" | "direct" | "professional") {
  if (mode === "direct") {
    return content
      .replace(/\bwould genuinely like to hear\b/gi, "want to hear")
      .replace(/\bcan be useful\b/gi, "helps")
      .replace(/\bmay be hiding\b/gi, "is being missed")
      .trim();
  }

  if (mode === "professional") {
    return `${content.trim()}

The goal is practical: clearer decisions, better follow-up, and stronger operating control.`;
  }

  return `${content.trim()}

Most owners are not looking for more noise. They are looking for relief, clarity, and a little more control over the day.`;
}
