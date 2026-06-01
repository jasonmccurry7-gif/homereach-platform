const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3061";

const htmlChecks = [
  {
    expectedText: ["Own the neighborhoods around your best customers.", "Market Capture"],
    label: "Homepage shell and content",
    path: "/",
    requireCssAssets: true,
  },
  {
    expectedText: ["Own the neighborhoods around your best customers.", "$499/month"],
    label: "Market Capture sales page",
    path: "/market-capture",
    requireCssAssets: true,
  },
  {
    expectedText: ["Market Capture", "Business Name"],
    label: "Market Capture intake",
    path: "/market-capture/intake",
    requireCssAssets: true,
  },
  { expectedText: ["Political"], label: "Political public page", path: "/political" },
  { expectedText: ["Targeted"], label: "Direct mail targeting page", path: "/targeted" },
];

const statusChecks = [
  { path: "/admin/ad-tech", expected: [307], label: "Admin Ad-Tech protected route" },
  { path: "/admin/ai-coo-queue", expected: [307], label: "Admin AI COO protected route" },
  { path: "/dashboard/campaign-launch", expected: [307], label: "Client launch protected route" },
  { path: "/dashboard/growth-intelligence", expected: [307], label: "Client growth protected route" },
  {
    body: "{}",
    expected: [401],
    label: "Admin Ad-Tech sync unauthenticated API",
    method: "POST",
    path: "/api/admin/ad-tech/sync",
  },
  {
    body: "{}",
    expected: [401],
    label: "Client Ad-Tech action unauthenticated API",
    method: "POST",
    path: "/api/ad-tech/actions",
  },
];

function target(path) {
  return new URL(path, baseUrl).toString();
}

function unique(values) {
  return [...new Set(values)];
}

function cssAssetsFrom(html) {
  const hrefs = [];
  const pattern = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) hrefs.push(match[1]);
  return unique(hrefs.filter((href) => href.includes("/_next/static/css/")));
}

async function fetchText(path, init) {
  const response = await fetch(target(path), init);
  const text = await response.text();
  return { response, text };
}

const failures = [];

for (const check of htmlChecks) {
  const { response, text } = await fetchText(check.path, { redirect: "manual" });
  const statusOk = response.status === 200;
  const missingText = check.expectedText.filter((snippet) => !text.includes(snippet));
  const cssAssets = cssAssetsFrom(text);
  const cssLinksOk = !check.requireCssAssets || cssAssets.length > 0;

  let cssAssetsOk = true;
  for (const href of cssAssets) {
    const cssResponse = await fetch(target(href), { redirect: "manual" });
    const contentType = cssResponse.headers.get("content-type") ?? "";
    const ok = cssResponse.status === 200 && contentType.includes("text/css");
    if (!ok) {
      cssAssetsOk = false;
      failures.push({
        actual: `${cssResponse.status} ${contentType || "missing content-type"}`,
        expected: ["200 text/css"],
        label: `${check.label} CSS asset`,
        path: href,
      });
    }
  }

  const ok = statusOk && missingText.length === 0 && cssLinksOk && cssAssetsOk;
  console.log(`${ok ? "PASS" : "FAIL"} ${response.status} ${check.label} ${check.path}`);

  if (!statusOk) {
    failures.push({ ...check, actual: response.status, expected: [200] });
  }
  if (missingText.length > 0) {
    failures.push({
      actual: `missing ${missingText.join(", ")}`,
      expected: check.expectedText,
      label: `${check.label} content`,
      path: check.path,
    });
  }
  if (!cssLinksOk) {
    failures.push({
      actual: "no Next.js CSS links found",
      expected: ["at least one /_next/static/css asset"],
      label: `${check.label} CSS links`,
      path: check.path,
    });
  }
}

for (const check of statusChecks) {
  const response = await fetch(target(check.path), {
    body: check.body,
    headers: check.body ? { "content-type": "application/json" } : undefined,
    method: check.method ?? "GET",
    redirect: "manual",
  });
  const ok = check.expected.includes(response.status);
  console.log(`${ok ? "PASS" : "FAIL"} ${response.status} ${check.label} ${check.path}`);
  if (!ok) failures.push({ ...check, actual: response.status });
}

if (failures.length > 0) {
  console.error("\nFoundation smoke failed:");
  for (const failure of failures) {
    console.error(`- ${failure.label}: expected ${failure.expected.join(" or ")}, got ${failure.actual} at ${failure.path}`);
  }
  process.exit(1);
}

console.log(`\nFoundation smoke passed against ${baseUrl}`);
