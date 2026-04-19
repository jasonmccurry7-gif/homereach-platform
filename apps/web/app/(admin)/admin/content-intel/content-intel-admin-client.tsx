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

async function getJson<T>(url: string): Promise<{ enabled: boolean; rows: T[] }> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return { enabled: false, rows: [] };
  if (!res.ok) return { enabled: true, rows: [] };
  const j = await res.json();
  return { enabled: true, rows: Array.isArray(j?.rows) ? j.rows : [] };
}

export default function ContentIntelAdminClient() {
  const [tab, setTab] = useState<"queue" | "insights" | "topics" | "channels">("queue");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [queue,   setQueue]   = useState<QueueRow[]>([]);
  const [insights,setInsights]= useState<Insight[]>([]);
  const [topics,  setTopics]  = useState<Topic[]>([]);
  const [channels,setChannels]= useState<Channel[]>([]);

  async function loadAll() {
    const [q, i, t, c] = await Promise.all([
      getJson<QueueRow>("/api/admin/content-intel/queue"),
      getJson<Insight>("/api/admin/content-intel/insights"),
      getJson<Topic>("/api/admin/content-intel/config/topics"),
      getJson<Channel>("/api/admin/content-intel/config/channels"),
    ]);
    setEnabled(q.enabled && i.enabled);
    setQueue(q.rows); setInsights(i.rows); setTopics(t.rows); setChannels(c.rows);
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

      <nav className="mb-4 flex gap-2 border-b">
        {(["queue", "insights", "topics", "channels"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm ${tab === k ? "border-b-2 border-black font-semibold" : "text-gray-500"}`}
          >{k.toUpperCase()}</button>
        ))}
      </nav>

      {tab === "queue" && <QueueTable rows={queue} />}
      {tab === "insights" && <InsightsTable rows={insights} onAction={approve} />}
      {tab === "topics" && <TopicsTable rows={topics} onRefresh={loadAll} />}
      {tab === "channels" && <ChannelsTable rows={channels} onRefresh={loadAll} />}
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
