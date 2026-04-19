"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Admin client for Content Intelligence. Three panels:
//   1. Ingestion Queue  — what videos ran through, with statuses
//   2. Insights         — ranked by APEX score, with approve/reject
//   3. Config           — category topics + trusted channels (inline edit)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

type QueueRow = {
  video_id: string; title: string; channel_name: string | null; category: string;
  relevance_score: number | null; status: string; is_forced_include: boolean;
  created_at: string; processed_at: string | null; skip_reason: string | null;
};
type Insight = {
  id: string; category: string; theme: string | null; insight_text: string;
  apex_score: number; is_translated: boolean; status: string; created_at: string;
};
type Topic   = { id: string; category: string; search_term: string; priority_score: number; active_flag: boolean };
type Channel = {
  id: string; channel_name: string; channel_id: string | null; category: string;
  trust_score: number; force_include: boolean; translate_saas: boolean; notes: string | null;
};
type TopChannel = {
  id: string; channel_name: string; channel_id: string | null; channel_url: string | null;
  category: string; specialty: string | null; trust_score: number; performance_score: number;
  force_include: boolean; translate_saas: boolean; active_flag: boolean;
  last_used: string | null; notes: string | null;
};
type Competitor = {
  id: string; name: string; category: string;
  competitor_type: string | null; content_source: string[];
  youtube_channel_id: string | null; youtube_handle: string | null; blog_url: string | null;
  priority_score: number; active_flag: boolean; notes: string | null; last_ingested_at: string | null;
};
type CompetitorInsight = {
  id: string; competitor_name: string; category: string; insight_type: string;
  insight_text: string; rationale: string | null; source_url: string | null;
  apex_score: number; status: string; created_at: string;
};

async function getJson<T>(url: string): Promise<{ enabled: boolean; rows: T[] }> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return { enabled: false, rows: [] };
  if (!res.ok) return { enabled: true, rows: [] };
  const j = await res.json();
  return { enabled: true, rows: Array.isArray(j?.rows) ? j.rows : [] };
}

type Tab = "queue" | "insights" | "topics" | "channels" | "top_channels" | "competitors" | "competitor_insights";

export default function ContentIntelAdminClient() {
  const [tab, setTab] = useState<Tab>("queue");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [queue,     setQueue]     = useState<QueueRow[]>([]);
  const [insights,  setInsights]  = useState<Insight[]>([]);
  const [topics,    setTopics]    = useState<Topic[]>([]);
  const [channels,  setChannels]  = useState<Channel[]>([]);
  const [topChans,  setTopChans]  = useState<TopChannel[]>([]);
  const [competitors,setCompetitors] = useState<Competitor[]>([]);
  const [compIns,   setCompIns]   = useState<CompetitorInsight[]>([]);

  async function loadAll() {
    const [q, i, t, c, tc, cm, ci] = await Promise.all([
      getJson<QueueRow>("/api/admin/content-intel/queue"),
      getJson<Insight>("/api/admin/content-intel/insights"),
      getJson<Topic>("/api/admin/content-intel/config/topics"),
      getJson<Channel>("/api/admin/content-intel/config/channels"),
      getJson<TopChannel>("/api/admin/content-intel/top-channels"),
      getJson<Competitor>("/api/admin/content-intel/config/competitors"),
      getJson<CompetitorInsight>("/api/admin/content-intel/competitor-insights"),
    ]);
    setEnabled(q.enabled && i.enabled);
    setQueue(q.rows); setInsights(i.rows); setTopics(t.rows); setChannels(c.rows);
    setTopChans(tc.rows); setCompetitors(cm.rows); setCompIns(ci.rows);
  }
  useEffect(() => { loadAll(); }, []);

  if (enabled === null) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }
  if (enabled === false) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Content Intelligence</h1>
        <p className="mt-2 text-sm text-gray-600">
          Disabled. Set <code className="rounded bg-gray-100 px-1">ENABLE_CONTENT_INTEL=true</code> to activate.
        </p>
      </div>
    );
  }

  async function approve(id: string, next: "approved" | "rejected") {
    await fetch("/api/admin/content-intel/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemType: "insight", itemId: id, outcome: next === "approved" ? "win" : "failed" }),
    });
    loadAll();
  }

  return (
    <div className="p-4 md:p-6">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Intelligence</h1>
          <p className="text-sm text-gray-600">
            YouTube → APEX filter → execution queue. Daily run via scheduled task.
          </p>
        </div>
      </header>

      <nav className="mb-4 flex gap-2 border-b overflow-x-auto">
        {(["queue", "insights", "top_channels", "competitor_insights", "topics", "channels", "competitors"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap px-3 py-2 text-sm ${tab === k ? "border-b-2 border-black font-semibold" : "text-gray-500"}`}
          >{k.replace(/_/g, " ").toUpperCase()}</button>
        ))}
      </nav>

      {tab === "queue" && <QueueTable rows={queue} />}
      {tab === "insights" && <InsightsTable rows={insights} onAction={approve} />}
      {tab === "top_channels" && <TopChannelsTable rows={topChans} />}
      {tab === "competitor_insights" && <CompetitorInsightsTable rows={compIns} />}
      {tab === "topics" && <TopicsTable rows={topics} onRefresh={loadAll} />}
      {tab === "channels" && <ChannelsTable rows={channels} onRefresh={loadAll} />}
      {tab === "competitors" && <CompetitorsTable rows={competitors} onRefresh={loadAll} />}
    </div>
  );
}

// ─── Top Channels (ranked by performance_score) ───────────────────────────────
function TopChannelsTable({ rows }: { rows: TopChannel[] }) {
  if (!rows.length) return <p className="text-sm text-gray-500">No trusted channels yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left"><tr>
        <th className="p-2">Channel</th><th className="p-2">Category</th><th className="p-2">Specialty</th>
        <th className="p-2">Trust</th><th className="p-2">Performance</th><th className="p-2">Force</th>
        <th className="p-2">Last used</th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="p-2">
              {r.channel_url ? (
                <a className="text-blue-700 underline" target="_blank" rel="noreferrer" href={r.channel_url}>{r.channel_name}</a>
              ) : r.channel_name}
              {r.channel_id && <span className="ml-2 text-xs text-gray-500">({r.channel_id})</span>}
            </td>
            <td className="p-2">{r.category}</td>
            <td className="p-2">{r.specialty ?? "—"}</td>
            <td className="p-2">{r.trust_score}</td>
            <td className="p-2 font-semibold">{r.performance_score}</td>
            <td className="p-2">{r.force_include ? "yes" : ""}</td>
            <td className="p-2 text-xs text-gray-500">{r.last_used ? new Date(r.last_used).toLocaleDateString() : "never"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Competitor Insights (read-only, APEX ranked) ─────────────────────────────
function CompetitorInsightsTable({ rows }: { rows: CompetitorInsight[] }) {
  if (!rows.length) return <p className="text-sm text-gray-500">No competitor insights yet. Add competitor sources under the Competitors tab and wait for the next run.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((i) => (
        <li key={i.id} className="rounded border bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-gray-500">
              {i.competitor_name} · {i.category} · {i.insight_type}
            </div>
            <div className="text-xs font-mono">APEX {i.apex_score}</div>
          </div>
          <p className="mt-1">{i.insight_text}</p>
          {i.rationale && <p className="mt-1 text-xs text-gray-500">Why: {i.rationale}</p>}
          {i.source_url && (
            <a className="mt-1 inline-block text-xs text-blue-700 underline" href={i.source_url} target="_blank" rel="noreferrer">source</a>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Competitors CRUD ─────────────────────────────────────────────────────────
function CompetitorsTable({ rows, onRefresh }: { rows: Competitor[]; onRefresh: () => void }) {
  const empty: Partial<Competitor> = {
    name: "", category: "*", competitor_type: "agency", content_source: ["youtube"],
    youtube_channel_id: "", youtube_handle: "", blog_url: "", priority_score: 5, active_flag: true, notes: "",
  };
  const [form, setForm] = useState<Partial<Competitor>>(empty);

  async function add() {
    if (!form.name) return;
    await fetch("/api/admin/content-intel/config/competitors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "upsert", ...form }),
    });
    setForm(empty);
    onRefresh();
  }
  async function remove(id: string) {
    await fetch("/api/admin/content-intel/config/competitors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    onRefresh();
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 text-sm">
        <input className="rounded border p-1" placeholder="competitor name" value={form.name ?? ""}
               onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="rounded border p-1" value={form.competitor_type ?? "agency"}
                onChange={(e) => setForm({ ...form, competitor_type: e.target.value })}>
          <option>agency</option><option>software</option><option>brand</option>
          <option>franchise</option><option>direct_mail</option><option>lead_gen</option><option>other</option>
        </select>
        <input className="rounded border p-1" placeholder="category (*=all)" value={form.category ?? "*"}
               onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="rounded border p-1" type="number" min={1} max={10} value={form.priority_score ?? 5}
               onChange={(e) => setForm({ ...form, priority_score: Number(e.target.value) })} />
        <input className="rounded border p-1" placeholder="YouTube channel id (UC…)" value={form.youtube_channel_id ?? ""}
               onChange={(e) => setForm({ ...form, youtube_channel_id: e.target.value })} />
        <input className="rounded border p-1" placeholder="YouTube handle (@…)" value={form.youtube_handle ?? ""}
               onChange={(e) => setForm({ ...form, youtube_handle: e.target.value })} />
        <input className="rounded border p-1 col-span-2" placeholder="blog url (optional)" value={form.blog_url ?? ""}
               onChange={(e) => setForm({ ...form, blog_url: e.target.value })} />
        <input className="rounded border p-1 col-span-3" placeholder="notes" value={form.notes ?? ""}
               onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button onClick={add} className="rounded border bg-black px-3 py-1 text-white">Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left"><tr>
          <th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Category</th>
          <th className="p-2">Priority</th><th className="p-2">YT channel</th>
          <th className="p-2">Active</th><th className="p-2">Last ingested</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.competitor_type ?? ""}</td>
              <td className="p-2">{r.category}</td>
              <td className="p-2">{r.priority_score}</td>
              <td className="p-2 text-xs">
                {r.youtube_channel_id || r.youtube_handle || "—"}
              </td>
              <td className="p-2">{r.active_flag ? "yes" : "no"}</td>
              <td className="p-2 text-xs text-gray-500">{r.last_ingested_at ? new Date(r.last_ingested_at).toLocaleDateString() : "never"}</td>
              <td className="p-2"><button className="text-xs text-red-600" onClick={() => remove(r.id)}>remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueTable({ rows }: { rows: QueueRow[] }) {
  if (!rows.length) return <p className="text-sm text-gray-500">No queue rows yet. Kick off a run.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-left"><tr>
        <th className="p-2">Video</th><th className="p-2">Channel</th><th className="p-2">Category</th>
        <th className="p-2">Score</th><th className="p-2">Status</th><th className="p-2">When</th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.video_id} className="border-t">
            <td className="p-2">
              <a className="text-blue-700 underline" target="_blank" rel="noreferrer"
                 href={`https://www.youtube.com/watch?v=${r.video_id}`}>{r.title}</a>
              {r.is_forced_include && <span className="ml-2 rounded bg-purple-100 px-1 text-xs text-purple-800">forced</span>}
              {r.skip_reason && <div className="text-xs text-red-600">skip: {r.skip_reason}</div>}
            </td>
            <td className="p-2">{r.channel_name}</td>
            <td className="p-2">{r.category}</td>
            <td className="p-2">{r.relevance_score ?? "—"}</td>
            <td className="p-2">{r.status}</td>
            <td className="p-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InsightsTable({
  rows, onAction,
}: { rows: Insight[]; onAction: (id: string, next: "approved" | "rejected") => void }) {
  if (!rows.length) return <p className="text-sm text-gray-500">No insights yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((i) => (
        <li key={i.id} className="rounded border bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase text-gray-500">
              {i.category}{i.theme ? ` · ${i.theme}` : ""}
              {i.is_translated && <span className="ml-2 rounded bg-amber-100 px-1 text-amber-800">translated</span>}
            </div>
            <div className="text-xs font-mono">APEX {i.apex_score}</div>
          </div>
          <p className="mt-1">{i.insight_text}</p>
          <div className="mt-2 flex gap-2 text-xs">
            <button onClick={() => onAction(i.id, "approved")} className="rounded border px-2 py-0.5 hover:bg-green-50">Approve</button>
            <button onClick={() => onAction(i.id, "rejected")} className="rounded border px-2 py-0.5 hover:bg-red-50">Reject</button>
            <span className="ml-auto text-gray-500">{i.status}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TopicsTable({ rows, onRefresh }: { rows: Topic[]; onRefresh: () => void }) {
  const [category, setCategory]   = useState("");
  const [term,     setTerm]       = useState("");
  const [priority, setPriority]   = useState(3);

  async function add() {
    if (!category || !term) return;
    await fetch("/api/admin/content-intel/config/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "upsert", category, search_term: term, priority_score: priority, active_flag: true }),
    });
    setCategory(""); setTerm(""); setPriority(3);
    onRefresh();
  }
  async function remove(id: string) {
    await fetch("/api/admin/content-intel/config/topics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    onRefresh();
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="rounded border p-1 text-sm" placeholder="category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input className="rounded border p-1 text-sm w-80" placeholder="search term" value={term} onChange={(e) => setTerm(e.target.value)} />
        <input className="rounded border p-1 text-sm w-16" type="number" min={1} max={5} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        <button onClick={add} className="rounded border bg-black px-3 py-1 text-sm text-white">Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left"><tr>
          <th className="p-2">Category</th><th className="p-2">Search term</th>
          <th className="p-2">Priority</th><th className="p-2">Active</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.category}</td>
              <td className="p-2">{r.search_term}</td>
              <td className="p-2">{r.priority_score}</td>
              <td className="p-2">{r.active_flag ? "yes" : "no"}</td>
              <td className="p-2"><button className="text-xs text-red-600" onClick={() => remove(r.id)}>remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChannelsTable({ rows, onRefresh }: { rows: Channel[]; onRefresh: () => void }) {
  const [form, setForm] = useState<Partial<Channel>>({
    channel_name: "", channel_id: "", category: "*", trust_score: 4, force_include: true, translate_saas: false, notes: "",
  });
  async function add() {
    if (!form.channel_name) return;
    await fetch("/api/admin/content-intel/config/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "upsert", ...form }),
    });
    setForm({ channel_name: "", channel_id: "", category: "*", trust_score: 4, force_include: true, translate_saas: false, notes: "" });
    onRefresh();
  }
  async function remove(id: string) {
    await fetch("/api/admin/content-intel/config/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    onRefresh();
  }
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6 text-sm">
        <input className="rounded border p-1" placeholder="channel name" value={form.channel_name ?? ""}
               onChange={(e) => setForm({ ...form, channel_name: e.target.value })} />
        <input className="rounded border p-1" placeholder="channel id (optional)" value={form.channel_id ?? ""}
               onChange={(e) => setForm({ ...form, channel_id: e.target.value })} />
        <input className="rounded border p-1" placeholder="category (*=all)" value={form.category ?? "*"}
               onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="rounded border p-1" type="number" min={1} max={5} value={form.trust_score ?? 4}
               onChange={(e) => setForm({ ...form, trust_score: Number(e.target.value) })} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={!!form.force_include}
               onChange={(e) => setForm({ ...form, force_include: e.target.checked })} /> force</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={!!form.translate_saas}
               onChange={(e) => setForm({ ...form, translate_saas: e.target.checked })} /> translate</label>
        <button onClick={add} className="col-span-2 rounded border bg-black px-3 py-1 text-white">Add</button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left"><tr>
          <th className="p-2">Channel</th><th className="p-2">Trust</th><th className="p-2">Force</th>
          <th className="p-2">Translate</th><th className="p-2">Category</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.channel_name}{r.channel_id && <span className="ml-2 text-xs text-gray-500">({r.channel_id})</span>}</td>
              <td className="p-2">{r.trust_score}</td>
              <td className="p-2">{r.force_include ? "yes" : ""}</td>
              <td className="p-2">{r.translate_saas ? "yes" : ""}</td>
              <td className="p-2">{r.category}</td>
              <td className="p-2"><button className="text-xs text-red-600" onClick={() => remove(r.id)}>remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
