import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const mailboxes = [
  { x: 92, y: 88, delay: "01" },
  { x: 214, y: 132, delay: "02" },
  { x: 505, y: 96, delay: "03" },
  { x: 626, y: 168, delay: "04" },
  { x: 126, y: 298, delay: "05" },
  { x: 244, y: 414, delay: "06" },
  { x: 512, y: 392, delay: "07" },
  { x: 652, y: 324, delay: "08" },
  { x: 404, y: 72, delay: "09" },
  { x: 392, y: 462, delay: "10" },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const business = clean(url.searchParams.get("business")) || "Current Customer";
  const city = clean(url.searchParams.get("city")) || "Local neighborhood";
  const industry = clean(url.searchParams.get("industry")) || "local service";
  const neighborhood = clean(url.searchParams.get("neighborhood")) || city;
  const households = clean(url.searchParams.get("households")) || "1,800-2,400 households";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily: "Arial, sans-serif",
          padding: "34px",
        }}
      >
        <div
          style={{
            width: "760px",
            height: "562px",
            display: "flex",
            position: "relative",
            borderRadius: "28px",
            overflow: "hidden",
            background: "#e8f2e7",
            border: "2px solid #bfd4c1",
          }}
        >
          <Road left={-70} top={245} width={900} rotate={-6} />
          <Road left={-70} top={96} width={900} rotate={18} />
          <Road left={52} top={-60} width={690} rotate={84} />
          <Road left={312} top={-70} width={730} rotate={92} />
          <Road left={-40} top={430} width={820} rotate={8} />
          <Zone left={34} top={32} label={neighborhood} />
          <Zone left={548} top={458} label={city} small />

          <div
            style={{
              position: "absolute",
              left: "288px",
              top: "212px",
              width: "178px",
              height: "146px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "28px",
              background: "#ffffff",
              border: "4px solid #0f766e",
              boxShadow: "0 22px 42px rgba(15, 23, 42, 0.22)",
              textAlign: "center",
              padding: "14px",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f766e", textTransform: "uppercase" }}>
              Current client
            </div>
            <div style={{ marginTop: "8px", fontSize: 24, fontWeight: 900, lineHeight: 1.05 }}>
              {business}
            </div>
            <div style={{ marginTop: "8px", fontSize: 13, fontWeight: 800, color: "#64748b" }}>
              Route anchor
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: "359px",
              top: "169px",
              width: "42px",
              height: "42px",
              borderRadius: "999px",
              background: "#0f766e",
              border: "6px solid #ccfbf1",
              boxShadow: "0 0 0 18px rgba(13,148,136,0.12)",
            }}
          />

          {mailboxes.map((box) => (
            <Mailbox key={box.delay} left={box.x} top={box.y} number={box.delay} />
          ))}
        </div>

        <div
          style={{
            flex: 1,
            marginLeft: "34px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f766e", textTransform: "uppercase" }}>
              Targeted Postcard Route
            </div>
            <div style={{ marginTop: "10px", fontSize: 42, fontWeight: 900, lineHeight: 1.02 }}>
              Postcards around every nearby mailbox.
            </div>
            <div style={{ marginTop: "18px", fontSize: 21, lineHeight: 1.3, color: "#475569", fontWeight: 700 }}>
              A real local job or client becomes the center point. HomeReach maps the surrounding streets, then builds a clean postcard route.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Metric label="Example route" value={neighborhood} />
            <Metric label="Planning range" value={households} />
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

function Road({ left, top, width, rotate }: { left: number; top: number; width: number; rotate: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height: "36px",
        transform: `rotate(${rotate}deg)`,
        background: "#ffffff",
        borderTop: "6px solid #cbd5e1",
        borderBottom: "6px solid #cbd5e1",
        opacity: 0.9,
      }}
    />
  );
}

function Zone({ left, top, label, small = false }: { left: number; top: number; label: string; small?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        display: "flex",
        padding: small ? "8px 12px" : "10px 16px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.8)",
        border: "1px solid rgba(100,116,139,0.22)",
        color: "#334155",
        fontSize: small ? 13 : 16,
        fontWeight: 900,
      }}
    >
      {label}
    </div>
  );
}

function Mailbox({ left, top, number }: { left: number; top: number; number: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: "88px",
        height: "78px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(-12deg)",
          borderRadius: "6px",
          background: "#ffffff",
          border: "3px solid #dc2626",
          color: "#dc2626",
          fontSize: 12,
          fontWeight: 900,
          boxShadow: "0 8px 16px rgba(15,23,42,0.16)",
        }}
      >
        MAIL
      </div>
      <div style={{ marginTop: "-2px", fontSize: 24, fontWeight: 900, color: "#dc2626" }}>v</div>
      <div
        style={{
          width: "54px",
          height: "30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "16px 16px 6px 6px",
          background: "#0f172a",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {number}
      </div>
      <div style={{ width: "8px", height: "16px", background: "#0f172a" }} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "16px 18px",
        borderRadius: "18px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 12px 26px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: "4px", fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{value}</div>
    </div>
  );
}
