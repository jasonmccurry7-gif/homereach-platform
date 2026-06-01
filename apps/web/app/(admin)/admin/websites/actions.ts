"use server";

import {
  db,
  websiteMaintenanceRequests,
  websiteProjects,
  type NewWebsiteMaintenanceRequest,
  type NewWebsiteProject,
  type WebsiteAssetChecklist,
} from "@homereach/db";
import { revalidatePath } from "next/cache";

export async function createWebsiteProjectAction(formData: FormData) {
  const businessName = readText(formData, "businessName") || "Untitled website client";
  const status = readText(formData, "status") || "intake_received";
  const accountStatus = readText(formData, "accountStatus") || "active";
  const businessId = readText(formData, "businessId");

  const assetChecklist: WebsiteAssetChecklist = {
    logoReceived: readCheckbox(formData, "logoReceived"),
    photosReceived: readCheckbox(formData, "photosReceived"),
    testimonialsReceived: readCheckbox(formData, "testimonialsReceived"),
    businessDescriptionReceived: readCheckbox(formData, "businessDescriptionReceived"),
    contactInformationVerified: readCheckbox(formData, "contactInformationVerified"),
    domainPurchased: readCheckbox(formData, "domainPurchased"),
    hostingActive: readCheckbox(formData, "hostingActive"),
    contentApproved: readCheckbox(formData, "contentApproved"),
    launchApproved: readCheckbox(formData, "launchApproved"),
  };

  const values: NewWebsiteProject = {
    businessId: businessId || null,
    clientName: readText(formData, "clientName"),
    businessName,
    businessType: readText(formData, "businessType") || null,
    phoneNumber: readText(formData, "phoneNumber") || null,
    email: readText(formData, "email") || null,
    domain: readText(formData, "domain") || null,
    websiteUrl: readUrl(formData, "websiteUrl"),
    hostingProvider: readText(formData, "hostingProvider") || null,
    githubRepositoryUrl: readUrl(formData, "githubRepositoryUrl"),
    deploymentUrl: readUrl(formData, "deploymentUrl"),
    hostingDashboardUrl: readUrl(formData, "hostingDashboardUrl"),
    domainRegistrarUrl: readUrl(formData, "domainRegistrarUrl"),
    googleBusinessProfileUrl: readUrl(formData, "googleBusinessProfileUrl"),
    facebookPageUrl: readUrl(formData, "facebookPageUrl"),
    analyticsDashboardUrl: readUrl(formData, "analyticsDashboardUrl"),
    monthlyPlanAmountCents: moneyToCents(readText(formData, "monthlyPlanAmount")),
    setupFeeCents: moneyToCents(readText(formData, "setupFee")),
    revenueToDateCents: moneyToCents(readText(formData, "revenueToDate")),
    lastPaymentDate: readDate(formData, "lastPaymentDate"),
    nextBillingDate: readDate(formData, "nextBillingDate"),
    launchDate: readDate(formData, "launchDate"),
    accountStatus: accountStatus as NewWebsiteProject["accountStatus"],
    status: status as NewWebsiteProject["status"],
    assignedTeamMember: readText(formData, "assignedTeamMember") || null,
    notes: readText(formData, "notes") || null,
    intake: {
      businessInformation: readText(formData, "businessInformation"),
      serviceAreas: readList(formData, "serviceAreas"),
      servicesOffered: readList(formData, "servicesOffered"),
      customerAvatar: readText(formData, "customerAvatar"),
      photosReceived: readText(formData, "photosReceivedNotes"),
      testimonialsReceived: readText(formData, "testimonialsReceivedNotes"),
      logoReceived: readText(formData, "logoReceivedNotes"),
      domainInformation: readText(formData, "domainInformation"),
      websiteGoals: readText(formData, "websiteGoals"),
      specialRequests: readText(formData, "specialRequests"),
    },
    assetChecklist,
    futureAuditHooks: {
      websiteAiAudit: { enabled: false, status: "phase_2" },
      seoAudit: { enabled: false, status: "phase_2" },
      conversionAudit: { enabled: false, status: "phase_2" },
      contentRefreshSuggestions: { enabled: false, status: "phase_2" },
      googleBusinessProfileAudit: { enabled: false, status: "phase_2" },
    },
    metadata: {
      source: "admin_websites_phase_1",
      managedExternally: true,
      noHostingInHomeReach: true,
    },
  };

  await db.insert(websiteProjects).values(values);
  revalidatePath("/admin/websites");
}

export async function createWebsiteMaintenanceRequestAction(formData: FormData) {
  const websiteProjectId = readText(formData, "websiteProjectId");
  const description = readText(formData, "description");
  if (!websiteProjectId || !description) {
    return;
  }

  const values: NewWebsiteMaintenanceRequest = {
    websiteProjectId,
    requestType: (readText(formData, "requestType") || "other") as NewWebsiteMaintenanceRequest["requestType"],
    description,
    priority: (readText(formData, "priority") || "medium") as NewWebsiteMaintenanceRequest["priority"],
    status: (readText(formData, "status") || "new") as NewWebsiteMaintenanceRequest["status"],
    assignedTo: readText(formData, "assignedTo") || null,
    completedDate: readDate(formData, "completedDate"),
    notes: readText(formData, "notes") || null,
    metadata: {
      source: "admin_websites_phase_2",
      approvalRequiredForPublishing: true,
      managementOnly: true,
    },
  };

  await db.insert(websiteMaintenanceRequests).values(values);
  revalidatePath("/admin/websites");
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function readDate(formData: FormData, key: string) {
  const value = readText(formData, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function readUrl(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function readList(formData: FormData, key: string) {
  return readText(formData, key)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function moneyToCents(value: string) {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 100);
}
