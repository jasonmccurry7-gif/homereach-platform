// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Database Seed
// Run with: npx tsx packages/db/src/seeds/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
config({ path: "../../.env" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  cities,
  categories,
  products,
  bundles,
  bundleProducts,
} from "../schema/index.js";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding HomeReach database...");

  // ── Cities ─────────────────────────────────────────────────────────────────
  const [austin, dallas, houston, sanAntonio] = await db
    .insert(cities)
    .values([
      { name: "Austin", state: "TX", slug: "austin-tx", isActive: true, launchedAt: new Date() },
      { name: "Dallas", state: "TX", slug: "dallas-tx", isActive: true, launchedAt: new Date() },
      { name: "Houston", state: "TX", slug: "houston-tx", isActive: false },
      { name: "San Antonio", state: "TX", slug: "san-antonio-tx", isActive: false },
    ])
    .returning()
    .onConflictDoNothing();

  console.log("✓ Cities seeded");

  // ── Categories ─────────────────────────────────────────────────────────────
  const insertedCategories = await db
    .insert(categories)
    .values([
      { name: "Restaurant & Food", slug: "restaurant", description: "Restaurants, cafes, bakeries, and food service businesses", icon: "🍽️" },
      { name: "Salon & Spa", slug: "salon-spa", description: "Hair salons, nail salons, spas, and beauty services", icon: "💅" },
      { name: "Auto Services", slug: "auto", description: "Auto repair, detailing, tires, and car care", icon: "🚗" },
      { name: "Fitness & Wellness", slug: "fitness", description: "Gyms, yoga studios, personal training, and wellness", icon: "💪" },
      { name: "Home Services", slug: "home-services", description: "HVAC, plumbing, cleaning, landscaping, and more", icon: "🏠" },
      { name: "Medical & Dental", slug: "medical", description: "Dentists, chiropractors, urgent care, and health clinics", icon: "🦷" },
      { name: "Real Estate", slug: "real-estate", description: "Agents, brokers, and property management", icon: "🏡" },
      { name: "Retail & Shopping", slug: "retail", description: "Boutiques, specialty shops, and local stores", icon: "🛍️" },
    ])
    .returning()
    .onConflictDoNothing();

  console.log("✓ Categories seeded");

  // ── Products ───────────────────────────────────────────────────────────────
  const insertedProducts = await db
    .insert(products)
    .values([
      {
        name: "Full-Color Postcard (Front Feature)",
        slug: "postcard-front",
        type: "postcard",
        description: "Premium front-page feature on a 6×9 full-color postcard mailed to 2,500+ homes",
        basePrice: "0.00",
        metadata: { side: "front", size: "6x9", quantity: 2500, fullColor: true },
      },
      {
        name: "Full-Color Postcard (Back Feature)",
        slug: "postcard-back",
        type: "postcard",
        description: "Back-page feature on a 6×9 full-color postcard mailed to 2,500+ homes",
        basePrice: "0.00",
        metadata: { side: "back", size: "6x9", quantity: 2500, fullColor: true },
      },
      {
        name: "Digital Neighborhood Ad",
        slug: "digital-neighborhood",
        type: "digital",
        description: "Geo-targeted digital ad delivered to the same neighborhood as your postcard",
        basePrice: "0.00",
        metadata: { channels: ["facebook", "instagram", "google"], impressions: 5000 },
      },
      {
        name: "SMS Outreach Campaign",
        slug: "sms-campaign",
        type: "automation",
        description: "Automated SMS campaign to 500 local prospects with reply tracking",
        basePrice: "0.00",
        metadata: { contacts: 500, messages: 2, replyTracking: true },
      },
      {
        name: "Email Outreach Campaign",
        slug: "email-campaign",
        type: "automation",
        description: "Branded email campaign to 1,000 local prospects",
        basePrice: "0.00",
        metadata: { contacts: 1000, messages: 3, replyTracking: true },
      },
      {
        name: "Performance Dashboard",
        slug: "dashboard",
        type: "digital",
        description: "Real-time dashboard showing reach, responses, and ROI",
        basePrice: "0.00",
        metadata: { includes: ["reach", "responses", "roi", "mapView"] },
      },
      {
        name: "Design Concierge",
        slug: "design-concierge",
        type: "digital",
        description: "Professional ad design by our creative team",
        basePrice: "0.00",
        metadata: { revisions: 2, turnaround: "48h" },
      },
    ])
    .returning()
    .onConflictDoNothing();

  console.log("✓ Products seeded");

  // Map products by slug for easy reference
  const productMap = Object.fromEntries(
    insertedProducts.map((p) => [p.slug, p])
  );

  // ── Bundles ────────────────────────────────────────────────────────────────
  // spotType in metadata: "anchor" | "front" | "back"
  // maxSpots: number of this bundle available per city/category combo
  // sortOrder: display order in funnel

  const insertedBundles = await db
    .insert(bundles)
    .values([
      // ─── Anchor Bundle (1 per city per category — most exclusive) ──────────
      {
        name: "Anchor",
        slug: "anchor",
        description: "Dominate your category. You are the only business in your category on this mailer — guaranteed exclusivity.",
        price: "997.00",
        isActive: true,
        cityId: null, // global — available in any city
        metadata: {
          spotType: "anchor",
          maxSpots: 1,
          sortOrder: 1,
          badgeText: "Most Exclusive",
          badgeColor: "amber",
          highlight: true,
          features: [
            "Front-page anchor position",
            "Category exclusivity guaranteed",
            "Digital neighborhood ad included",
            "SMS outreach campaign (500 contacts)",
            "Email outreach campaign (1,000 contacts)",
            "Performance dashboard",
            "Design concierge included",
            "2,500+ homes reached",
          ],
        },
      },
      // ─── Front Bundle (limited — 2–3 per city per category) ───────────────
      {
        name: "Front Feature",
        slug: "front-feature",
        description: "A premium front-page ad with digital amplification to the same neighborhood.",
        price: "597.00",
        isActive: true,
        cityId: null,
        metadata: {
          spotType: "front",
          maxSpots: 3,
          sortOrder: 2,
          badgeText: "Most Popular",
          badgeColor: "blue",
          highlight: false,
          features: [
            "Front-page feature position",
            "Digital neighborhood ad included",
            "Email outreach campaign (1,000 contacts)",
            "Performance dashboard",
            "Design concierge included",
            "2,500+ homes reached",
          ],
        },
      },
      // ─── Back Bundle (most available — 4–6 per city per category) ─────────
      {
        name: "Back Feature",
        slug: "back-feature",
        description: "A full-color back-page ad — the most cost-effective way to get in front of your neighborhood.",
        price: "297.00",
        isActive: true,
        cityId: null,
        metadata: {
          spotType: "back",
          maxSpots: 6,
          sortOrder: 3,
          badgeText: "Best Value",
          badgeColor: "green",
          highlight: false,
          features: [
            "Back-page feature position",
            "Performance dashboard",
            "2,500+ homes reached",
          ],
        },
      },
    ])
    .returning()
    .onConflictDoNothing();

  console.log("✓ Bundles seeded");

  const bundleMap = Object.fromEntries(
    insertedBundles.map((b) => [b.slug, b])
  );

  // ── Bundle ↔ Products ──────────────────────────────────────────────────────
  if (bundleMap["anchor"] && productMap["postcard-front"]) {
    await db
      .insert(bundleProducts)
      .values([
        // Anchor bundle products
        { bundleId: bundleMap["anchor"]!.id, productId: productMap["postcard-front"]!.id, quantity: 1 },
        { bundleId: bundleMap["anchor"]!.id, productId: productMap["digital-neighborhood"]!.id, quantity: 1 },
        { bundleId: bundleMap["anchor"]!.id, productId: productMap["sms-campaign"]!.id, quantity: 1 },
        { bundleId: bundleMap["anchor"]!.id, productId: productMap["email-campaign"]!.id, quantity: 1 },
        { bundleId: bundleMap["anchor"]!.id, productId: productMap["dashboard"]!.id, quantity: 1 },
        { bundleId: bundleMap["anchor"]!.id, productId: productMap["design-concierge"]!.id, quantity: 1 },
        // Front feature bundle products
        { bundleId: bundleMap["front-feature"]!.id, productId: productMap["postcard-front"]!.id, quantity: 1 },
        { bundleId: bundleMap["front-feature"]!.id, productId: productMap["digital-neighborhood"]!.id, quantity: 1 },
        { bundleId: bundleMap["front-feature"]!.id, productId: productMap["email-campaign"]!.id, quantity: 1 },
        { bundleId: bundleMap["front-feature"]!.id, productId: productMap["dashboard"]!.id, quantity: 1 },
        { bundleId: bundleMap["front-feature"]!.id, productId: productMap["design-concierge"]!.id, quantity: 1 },
        // Back feature bundle products
        { bundleId: bundleMap["back-feature"]!.id, productId: productMap["postcard-back"]!.id, quantity: 1 },
        { bundleId: bundleMap["back-feature"]!.id, productId: productMap["dashboard"]!.id, quantity: 1 },
      ])
      .onConflictDoNothing();
  }

  console.log("✓ Bundle products seeded");
  console.log("✅ Seed complete");
  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
