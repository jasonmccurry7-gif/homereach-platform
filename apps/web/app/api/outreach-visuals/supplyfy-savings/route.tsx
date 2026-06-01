import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const categoryRows: Record<string, Array<{ item: string; current: string; best: string; save: string }>> = {
  bakery: [
    { item: "Flour", current: "$31.80", best: "$27.60", save: "13.2%" },
    { item: "Butter", current: "$4.78", best: "$4.26", save: "10.9%" },
    { item: "Sugar", current: "$48.40", best: "$42.25", save: "12.7%" },
    { item: "Packaging", current: "$0.19", best: "$0.15", save: "21.1%" },
  ],
  pizza: [
    { item: "Mozzarella", current: "$2.94", best: "$2.58", save: "12.2%" },
    { item: "Flour", current: "$31.80", best: "$27.60", save: "13.2%" },
    { item: "Tomatoes", current: "$42.60", best: "$37.90", save: "11.0%" },
    { item: "Boxes", current: "$0.54", best: "$0.45", save: "16.7%" },
  ],
  cafe: [
    { item: "Coffee", current: "$9.40", best: "$8.18", save: "13.0%" },
    { item: "Milk", current: "$4.12", best: "$3.68", save: "10.7%" },
    { item: "Cups", current: "$0.082", best: "$0.069", save: "15.9%" },
    { item: "Pastry cases", current: "$41.20", best: "$35.90", save: "12.9%" },
  ],
  restaurant: [
    { item: "Produce", current: "$382", best: "$338", save: "11.5%" },
    { item: "Fryer oil", current: "$44.20", best: "$39.75", save: "10.1%" },
    { item: "Proteins", current: "$5.86", best: "$5.21", save: "11.1%" },
    { item: "Paper goods", current: "$0.128", best: "$0.104", save: "18.8%" },
  ],
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const business = clean(url.searchParams.get("business")) || "Local Operator";
  const category = clean(url.searchParams.get("category")).toLowerCase();
  const rows = rowsForCategory(category);
  const seed = stableHash(`${business}:${category}`);
  const monthlySavings = 920 + (seed % 1280);
  const savingsPercent = 8 + (seed % 7);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "Arial, sans-serif",
          padding: "36px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f766e", textTransform: "uppercase" }}>
              SupplyFy Daily Price Visibility
            </div>
            <div style={{ marginTop: "8px", fontSize: 38, fontWeight: 900, lineHeight: 1.05 }}>
              {`Ingredient savings dashboard for ${business}`}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 18px",
              borderRadius: "999px",
              background: "#ecfeff",
              border: "2px solid #99f6e4",
              color: "#0f766e",
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            Best prices refreshed daily
          </div>
        </div>

        <div style={{ marginTop: "28px", display: "flex", gap: "24px", flex: 1 }}>
          <div
            style={{
              width: "398px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "26px",
              background: "#0f172a",
              color: "#ffffff",
              padding: "28px",
              boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#99f6e4", textTransform: "uppercase" }}>
                Estimated savings
              </div>
              <div style={{ marginTop: "10px", fontSize: 70, fontWeight: 900, lineHeight: 0.95 }}>
                {`$${monthlySavings.toLocaleString()}`}
              </div>
              <div style={{ marginTop: "8px", fontSize: 28, fontWeight: 900, color: "#ccfbf1" }}>
                / month
              </div>
              <div style={{ marginTop: "18px", fontSize: 22, lineHeight: 1.28, fontWeight: 700, color: "#cbd5e1" }}>
                Visibility on ingredient pricing, repeat purchases, vendor changes, and best-price movement.
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <MiniStat label="Margin lift" value={`${savingsPercent}%`} />
              <MiniStat label="Watchlist" value="12 SKUs" />
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRadius: "26px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              padding: "24px",
              boxShadow: "0 18px 42px rgba(15,23,42,0.10)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px 12px" }}>
              <HeaderCell label="Ingredient" />
              <HeaderCell label="Current" />
              <HeaderCell label="Best today" />
              <HeaderCell label="Savings" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {rows.map((row, index) => (
                <IngredientRow key={row.item} row={row} index={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function clean(value: string | null) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 92) ?? "";
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function rowsForCategory(category: string): Array<{ item: string; current: string; best: string; save: string }> {
  if (category.includes("bakery") || category.includes("baker")) return categoryRows.bakery ?? categoryRows.restaurant ?? [];
  if (category.includes("pizza")) return categoryRows.pizza ?? categoryRows.restaurant ?? [];
  if (category.includes("cafe") || category.includes("coffee")) return categoryRows.cafe ?? categoryRows.restaurant ?? [];
  return categoryRows.restaurant ?? [];
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "14px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.16)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: "#99f6e4", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: "6px", fontSize: 24, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function HeaderCell({ label }: { label: string }) {
  return (
    <div style={{ width: "25%", fontSize: 13, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
      {label}
    </div>
  );
}

function IngredientRow({
  row,
  index,
}: {
  row: { item: string; current: string; best: string; save: string };
  index: number;
}) {
  const accent = index === 0 ? "#16a34a" : index === 1 ? "#0f766e" : index === 2 ? "#2563eb" : "#7c3aed";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "16px 18px",
        borderRadius: "18px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ width: "25%", display: "flex", alignItems: "center" }}>
        <div style={{ width: "12px", height: "42px", borderRadius: "999px", background: accent, marginRight: "12px" }} />
        <div style={{ fontSize: 23, fontWeight: 900 }}>{row.item}</div>
      </div>
      <div style={{ width: "25%", fontSize: 24, fontWeight: 900, color: "#64748b" }}>{row.current}</div>
      <div style={{ width: "25%", fontSize: 24, fontWeight: 900, color: "#0f766e" }}>{row.best}</div>
      <div
        style={{
          width: "25%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "999px",
          background: "#dcfce7",
          color: "#166534",
          fontSize: 23,
          fontWeight: 900,
          padding: "8px 0",
        }}
      >
        {row.save}
      </div>
    </div>
  );
}
