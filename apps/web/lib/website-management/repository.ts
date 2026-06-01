import {
  businesses,
  db,
  websiteMaintenanceRequests,
  websiteProjects,
  type WebsiteMaintenanceRequest,
  type WebsiteProject,
} from "@homereach/db";
import { desc, eq } from "drizzle-orm";

export type { WebsiteMaintenanceRequest } from "@homereach/db";

export const WEBSITE_STATUS_LABELS: Record<WebsiteProject["status"], string> = {
  intake_received: "Intake Received",
  awaiting_assets: "Awaiting Assets",
  building: "Building",
  client_review: "Client Review",
  revisions: "Revisions",
  ready_for_launch: "Ready For Launch",
  live: "Live",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const ACCOUNT_STATUS_LABELS: Record<WebsiteProject["accountStatus"], string> = {
  active: "Active",
  past_due: "Past Due",
  cancelled: "Cancelled",
};

export const MAINTENANCE_REQUEST_TYPE_LABELS: Record<WebsiteMaintenanceRequest["requestType"], string> = {
  change_phone_number: "Change Phone Number",
  add_service: "Add Service",
  replace_image: "Replace Image",
  add_testimonial: "Add Testimonial",
  new_page_request: "New Page Request",
  content_update: "Content Update",
  technical_issue: "Technical Issue",
  other: "Other",
};

export const MAINTENANCE_PRIORITY_LABELS: Record<WebsiteMaintenanceRequest["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const MAINTENANCE_STATUS_LABELS: Record<WebsiteMaintenanceRequest["status"], string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In Progress",
  waiting_on_client: "Waiting On Client",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type WebsiteClientOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
};

export type WebsiteProjectRow = {
  website: WebsiteProject;
  business: WebsiteClientOption | null;
  maintenanceRequests: WebsiteMaintenanceRequest[];
};

type WebsiteProjectBaseRow = Omit<WebsiteProjectRow, "maintenanceRequests">;

export type WebsiteDashboardSummary = {
  totalWebsites: number;
  monthlyWebsiteRevenueCents: number;
  websitesInBuild: number;
  pendingReview: number;
  liveWebsites: number;
  pastDueAccounts: number;
  upcomingRenewals: number;
  averageRevenuePerWebsiteCents: number;
  launchesThisMonth: number;
  maintenanceRequestsOpen: number;
  urgentMaintenanceRequests: number;
  activeWebsites: number;
  pendingBuilds: number;
};

export async function loadWebsiteManagementDashboard() {
  const dataIssues: string[] = [];

  const rows = await safeQuery<WebsiteProjectBaseRow>("website_projects", async () =>
    db
      .select({
        website: websiteProjects,
        business: {
          id: businesses.id,
          name: businesses.name,
          email: businesses.email,
          phone: businesses.phone,
          website: businesses.website,
        },
      })
      .from(websiteProjects)
      .leftJoin(businesses, eq(websiteProjects.businessId, businesses.id))
      .orderBy(desc(websiteProjects.updatedAt))
      .limit(200),
    dataIssues,
  );

  const maintenanceRequests = await safeQuery<WebsiteMaintenanceRequest>("website_maintenance_requests", async () =>
    db
      .select()
      .from(websiteMaintenanceRequests)
      .orderBy(desc(websiteMaintenanceRequests.updatedAt))
      .limit(300),
    dataIssues,
  );

  const requestsByWebsite = new Map<string, WebsiteMaintenanceRequest[]>();
  for (const request of maintenanceRequests) {
    const existing = requestsByWebsite.get(request.websiteProjectId) ?? [];
    existing.push(request);
    requestsByWebsite.set(request.websiteProjectId, existing);
  }

  const hydratedRows = rows.map((row) => ({
    ...row,
    maintenanceRequests: requestsByWebsite.get(row.website.id) ?? [],
  }));

  const clientOptions = await safeQuery<WebsiteClientOption>("businesses", async () =>
    db
      .select({
        id: businesses.id,
        name: businesses.name,
        email: businesses.email,
        phone: businesses.phone,
        website: businesses.website,
      })
      .from(businesses)
      .orderBy(desc(businesses.createdAt))
      .limit(300),
    dataIssues,
  );

  return {
    rows: hydratedRows,
    maintenanceRequests,
    clientOptions,
    summary: buildWebsiteSummary(
      hydratedRows.map((row) => row.website),
      maintenanceRequests,
    ),
    dataIssues,
  };
}

async function safeQuery<T>(
  source: string,
  read: () => PromiseLike<T[]> | T[],
  issues: string[],
): Promise<T[]> {
  try {
    const result = await read();
    return Array.isArray(result) ? result : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown data access error";
    console.error(`[website-management] ${source} query failed`, error);
    issues.push(`${source}: ${message}`);
    return [];
  }
}

function buildWebsiteSummary(
  websites: WebsiteProject[],
  maintenanceRequests: WebsiteMaintenanceRequest[],
): WebsiteDashboardSummary {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const activeRevenueWebsites = websites.filter(
    (website) => website.accountStatus === "active" && !["cancelled", "paused"].includes(website.status),
  );

  return {
    totalWebsites: websites.length,
    monthlyWebsiteRevenueCents: activeRevenueWebsites.reduce(
      (sum, website) => sum + website.monthlyPlanAmountCents,
      0,
    ),
    websitesInBuild: websites.filter((website) =>
      ["awaiting_assets", "building", "revisions"].includes(website.status),
    ).length,
    pendingReview: websites.filter((website) => website.status === "client_review").length,
    liveWebsites: websites.filter((website) => website.status === "live").length,
    pastDueAccounts: websites.filter((website) => website.accountStatus === "past_due").length,
    upcomingRenewals: websites.filter((website) => {
      if (!website.nextBillingDate || website.accountStatus !== "active") return false;
      const billingDate = new Date(`${website.nextBillingDate}T00:00:00`);
      const diffDays = (billingDate.getTime() - now.getTime()) / 86_400_000;
      return diffDays >= 0 && diffDays <= 30;
    }).length,
    averageRevenuePerWebsiteCents:
      activeRevenueWebsites.length === 0
        ? 0
        : Math.round(
            activeRevenueWebsites.reduce((sum, website) => sum + website.monthlyPlanAmountCents, 0) /
              activeRevenueWebsites.length,
          ),
    launchesThisMonth: websites.filter((website) => {
      if (!website.launchDate) return false;
      const launchDate = new Date(`${website.launchDate}T00:00:00`);
      return launchDate.getMonth() === month && launchDate.getFullYear() === year;
    }).length,
    maintenanceRequestsOpen: maintenanceRequests.filter(
      (request) => !["completed", "cancelled"].includes(request.status),
    ).length,
    urgentMaintenanceRequests: maintenanceRequests.filter(
      (request) => request.priority === "urgent" && !["completed", "cancelled"].includes(request.status),
    ).length,
    activeWebsites: websites.filter((website) => website.accountStatus === "active").length,
    pendingBuilds: websites.filter((website) =>
      ["intake_received", "awaiting_assets", "building", "client_review", "revisions", "ready_for_launch"].includes(
        website.status,
      ),
    ).length,
  };
}
