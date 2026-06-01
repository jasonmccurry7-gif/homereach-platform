import { describe, expect, it } from "vitest";
import {
  buildOutreachDrafts,
  buildSenderOutreachDrafts,
  buildSocialPosts,
  normalizePriority,
  scheduleForSender,
} from "../drafts";
import { calculateDailyStats, dateRangeForExport } from "../server";
import type { DailyOutreachTask } from "../types";

describe("daily outreach drafts", () => {
  it("creates human-review drafts without auto-send language", () => {
    const drafts = buildOutreachDrafts({
      category: "Targeted Campaign",
      businessName: "Apex Roofing",
      contactName: "Taylor Smith",
      industry: "Roofing",
    });

    expect(drafts.emailSubject).toContain("Apex Roofing");
    expect(drafts.emailBody).toContain("Hi Taylor,");
    expect(drafts.smsBody).toContain("Reply STOP to opt out");
    expect(drafts.dmBody).toContain("Would you be open");
  });

  it("keeps political outreach focused on execution and logistics", () => {
    const drafts = buildOutreachDrafts({
      category: "Political Outreach",
      campaignName: "County Commissioner Campaign",
    });

    expect(drafts.emailBody).toContain("No voter profiling");
    expect(drafts.emailBody).toContain("geography");
    expect(drafts.emailBody).not.toMatch(/ideology|persuasion score/i);
  });

  it("creates Josh visual route-density emails with required local campaign language", () => {
    const drafts = buildSenderOutreachDrafts({
      senderKey: "josh",
      date: "2026-05-26",
      sequence: 1,
      category: "Targeted Campaign",
      businessName: "Apex Roofing",
      contactName: "Taylor Smith",
      industry: "Roofing",
    });

    expect(drafts.emailBody).toContain("neighbors around existing jobs");
    expect(drafts.emailBody).toContain("shared cost with other local businesses");
    expect(drafts.emailBody).toContain("[[image:");
    expect(drafts.emailBody).toContain("current customer or best local job in the middle");
    expect(drafts.visual.type).toBe("targeted_neighborhood_mailbox_map");
    expect(drafts.visual.url).toContain("/api/outreach-visuals/targeted-neighborhood");
  });

  it("creates Jason political emails with four campaign options", () => {
    const drafts = buildSenderOutreachDrafts({
      senderKey: "jason",
      date: "2026-05-26",
      sequence: 2,
      category: "Political Outreach",
      campaignName: "County Commissioner Campaign",
    });

    expect(drafts.emailBody).toContain("Candidate introduction / name recognition");
    expect(drafts.emailBody).toContain("Local issue and plan card");
    expect(drafts.emailBody).toContain("Trust, validators, or contrast card");
    expect(drafts.emailBody).toContain("Final ballot-window reminder");
    expect(drafts.visual.type).toBe("candidate_four_postcard_options");
    expect(drafts.visual.url).toContain("/api/political/candidate-options-image");
    expect(drafts.emailBody).not.toMatch(/ideology|persuasion score/i);
  });

  it("creates SupplyFy savings dashboard visuals for procurement emails", () => {
    const drafts = buildSenderOutreachDrafts({
      senderKey: "heather",
      date: "2026-05-26",
      sequence: 3,
      category: "Procurement / Supplify",
      businessName: "Main Street Pizza",
      contactName: "Morgan Lee",
      industry: "Pizza shop",
    });

    expect(drafts.emailBody).toContain("ingredient savings in big, plain numbers");
    expect(drafts.emailBody).toContain("daily best-price visibility");
    expect(drafts.visual.type).toBe("supplyfy_ingredient_savings_dashboard");
    expect(drafts.visual.url).toContain("/api/outreach-visuals/supplyfy-savings");
  });

  it("spaces sender schedules at least 45 minutes inside the daily window", () => {
    const first = new Date(scheduleForSender("2026-05-26", "chelsi", 1)).getTime();
    const second = new Date(scheduleForSender("2026-05-26", "chelsi", 2)).getTime();
    const fifth = new Date(scheduleForSender("2026-05-26", "chelsi", 5)).getTime();

    expect(second - first).toBeGreaterThanOrEqual(45 * 60 * 1000);
    expect(new Date(first).getUTCHours()).toBeGreaterThanOrEqual(12);
    expect(new Date(fifth).getUTCHours()).toBeLessThanOrEqual(20);
  });

  it("normalizes unexpected priority values", () => {
    expect(normalizePriority("urgent")).toBe("urgent");
    expect(normalizePriority("unknown")).toBe("medium");
  });

  it("builds the expected daily social post set", () => {
    const posts = buildSocialPosts("2026-05-26");

    expect(posts).toHaveLength(7);
    expect(posts.some((post) => post.post_type === "Facebook group post")).toBe(true);
    expect(posts.every((post) => post.outreach_date === "2026-05-26")).toBe(true);
  });
});

describe("daily outreach stats and export ranges", () => {
  it("calculates daily execution metrics from tasks, posts, and activity", () => {
    const task = {
      id: "task-1",
      outreach_date: "2026-05-26",
      category: "Targeted Campaign",
      action_type: "email",
      priority: "high",
      status: "completed",
      completed: true,
      response_received: true,
      created_at: "2026-05-26T12:00:00.000Z",
    } satisfies DailyOutreachTask;

    const stats = calculateDailyStats(
      [task],
      [{
        id: "post-1",
        outreach_date: "2026-05-26",
        category: "Community",
        post_type: "Facebook group post",
        content: "Hello",
        status: "posted",
        posted: true,
        created_at: "2026-05-26T12:00:00.000Z",
      }],
      [{
        id: "activity-1",
        outreach_date: "2026-05-26",
        activity_type: "email_draft_opened",
        status: "logged",
        created_at: "2026-05-26T12:00:00.000Z",
      }],
      "2026-05-26"
    );

    expect(stats.todayTasks).toBe(1);
    expect(stats.completedToday).toBe(1);
    expect(stats.emailDraftsOpened).toBe(1);
    expect(stats.responsesReceived).toBe(1);
    expect(stats.groupPostsCompleted).toBe(1);
  });

  it("returns stable date ranges for Excel exports", () => {
    const now = new Date("2026-05-26T15:00:00.000Z");

    expect(dateRangeForExport("today", now)).toMatchObject({
      key: "today",
      startDate: "2026-05-26",
      endDate: "2026-05-26",
    });
    expect(dateRangeForExport("week", now)).toMatchObject({
      key: "week",
      startDate: "2026-05-20",
      endDate: "2026-05-26",
    });
  });
});
