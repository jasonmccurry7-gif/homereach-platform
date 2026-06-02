import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "apps", "web", "lib", "service-catalog", "production-service-catalog.json");
const args = new Set(process.argv.slice(2));

const checkRoutes = args.has("--check-routes") || process.env.SERVICE_CATALOG_CHECK_ROUTES === "1";
const includeProtectedRoutes = args.has("--include-protected-routes");
const baseUrl =
  process.env.SERVICE_CATALOG_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  process.env.HOMEREACH_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3061";

const requiredStringFields = [
  "id",
  "publicName",
  "category",
  "offerType",
  "productionStatus",
  "primaryOwner",
  "publicPath",
  "startPath",
  "adminPath",
  "customerPath",
  "renewalMotion",
  "readinessNotes",
];

const requiredArrayFields = [
  "docs",
  "deliverables",
  "fulfillmentSteps",
  "reportingMetrics",
  "approvalGates",
  "smokeTests",
  "issueHandling",
];

const allowedStatuses = new Set([
  "sellable_now",
  "sellable_manual",
  "sellable_manual_compliance_review",
  "sellable_with_political_compliance",
  "sellable_needs_fresh_smoke",
  "sellable_needs_inventory_audit",
  "manual_sellable",
  "manual_sellable_with_publish_gate",
  "sales_wedge_ready",
  "pilot_only",
  "pilot_sellable_with_activation_gate",
  "internal_first",
  "internal_foundation",
  "internal_then_client",
  "manual_launch_only",
  "internal_only",
]);

const sellableStatuses = new Set([
  "sellable_now",
  "sellable_manual",
  "sellable_manual_compliance_review",
  "sellable_with_political_compliance",
  "manual_sellable",
  "manual_sellable_with_publish_gate",
  "sales_wedge_ready",
  "pilot_sellable_with_activation_gate",
]);

function asIssue(offer, field, message) {
  return { offerId: offer?.id || "catalog", field, message };
}

function readCatalog() {
  const raw = readFileSync(catalogPath, "utf8");
  return JSON.parse(raw);
}

function validateCatalog(catalog) {
  const critical = [];
  const warnings = [];
  const ids = new Set();

  if (!Array.isArray(catalog) || catalog.length === 0) {
    critical.push(asIssue(null, "catalog", "Catalog must be a non-empty array."));
    return { critical, warnings };
  }

  for (const offer of catalog) {
    for (const field of requiredStringFields) {
      if (typeof offer[field] !== "string" || offer[field].trim().length === 0) {
        critical.push(asIssue(offer, field, "Required string field is missing."));
      }
    }

    if (ids.has(offer.id)) {
      critical.push(asIssue(offer, "id", "Duplicate offer id."));
    }
    ids.add(offer.id);

    if (!allowedStatuses.has(offer.productionStatus)) {
      critical.push(asIssue(offer, "productionStatus", `Unknown production status: ${offer.productionStatus}`));
    }

    if (!offer.price || typeof offer.price !== "object") {
      critical.push(asIssue(offer, "price", "Price object is missing."));
    } else {
      for (const field of ["public", "billingMode", "stripeStatus"]) {
        if (typeof offer.price[field] !== "string" || offer.price[field].trim().length === 0) {
          critical.push(asIssue(offer, `price.${field}`, "Required price field is missing."));
        }
      }
    }

    for (const field of requiredArrayFields) {
      if (!Array.isArray(offer[field]) || offer[field].length === 0) {
        critical.push(asIssue(offer, field, "Required array field must have at least one item."));
      }
    }

    for (const docPath of offer.docs || []) {
      if (!existsSync(path.join(root, docPath))) {
        warnings.push(asIssue(offer, "docs", `Referenced doc does not exist yet: ${docPath}`));
      }
    }

    if (sellableStatuses.has(offer.productionStatus)) {
      for (const field of ["publicPath", "startPath", "adminPath"]) {
        if (!offer[field].startsWith("/")) {
          critical.push(asIssue(offer, field, "Sellable offers must include an application path."));
        }
      }
    }
  }

  return { critical, warnings };
}

function routesForCatalog(catalog) {
  const routeMap = new Map();

  for (const offer of catalog) {
    for (const field of ["publicPath", "startPath"]) {
      if (typeof offer[field] === "string" && offer[field].startsWith("/")) {
        routeMap.set(`${offer.id}:${field}`, { offerId: offer.id, field, route: offer[field], protected: false });
      }
    }

    if (includeProtectedRoutes) {
      for (const field of ["adminPath", "customerPath"]) {
        if (typeof offer[field] === "string" && offer[field].startsWith("/")) {
          routeMap.set(`${offer.id}:${field}`, { offerId: offer.id, field, route: offer[field], protected: true });
        }
      }
    }
  }

  return [...routeMap.values()];
}

async function checkRoute(routeCheck) {
  const url = new URL(routeCheck.route, baseUrl).toString();
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual" });
    const okPublic = response.status >= 200 && response.status < 400;
    const okProtected = routeCheck.protected && [200, 302, 303, 307, 308, 401, 403].includes(response.status);
    return {
      ...routeCheck,
      url,
      status: response.status,
      ok: okPublic || okProtected,
    };
  } catch (error) {
    return {
      ...routeCheck,
      url,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const catalog = readCatalog();
  const { critical, warnings } = validateCatalog(catalog);
  const routeChecks = [];

  if (checkRoutes) {
    const checks = routesForCatalog(catalog);
    for (const check of checks) {
      routeChecks.push(await checkRoute(check));
    }

    for (const result of routeChecks) {
      if (!result.ok) {
        warnings.push(asIssue({ id: result.offerId }, result.field, `Route check failed: ${result.url} (${result.status})`));
      }
    }
  }

  const summary = {
    ok: critical.length === 0,
    catalogPath,
    offers: Array.isArray(catalog) ? catalog.length : 0,
    critical,
    warnings,
    routeChecks,
    routeChecksEnabled: checkRoutes,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (critical.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
