"use client";

import React, { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  facebook_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  score: number;
  buying_signal: boolean;
  status: string;
  notes: string | null;
  last_contacted_at: string | null;
  last_reply_at: string | null;
  next_follow_up_at: string | null;
};

type TextTask     = { lead: Lead; draft: { body: string } };
type EmailTask    = { lead: Lead; draft: { subject: string; body: string } };
type FbDmTask     = { lead: Lead; draft: { body: string } };
type FollowUpTask = { lead: Lead; draft: { subject?: string; body: string }; channel: "sms" | "email"; days_since: number; overdue: boolean };
type ReplyTask    = { lead: Lead; last_reply_at: string | null; suggested_response: string };
type GroupPost    = { id: string; group_name: string; city: string; post_copy: string; scheduled_for: string | null };

type TaskData = {
  date: string;
  agent: { id: string; name: string };
  sections: {
    replies:      ReplyTask[];
    followups:    FollowUpTask[];
    texts:        TextTask[];
    emails:       EmailTask[];
    facebook_dms: FbDmTask[];
    group_posts:  GroupPost[];
  };
  totals: {
    total_tasks:         number;
    sent_today:          number;
    deals_today:         number;
    revenue_today_cents: number;
  };
};

type SectionKey = "replies" | "followups" | "texts" | "emails" | "facebook_dms" | "group_posts";

type SessionStats = { sent: number; deals: number; revenue: number };

type Reply = {
  id: string;
  lead_id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  message: string;
  channel: "sms" | "email";
  received_at: string;
  city: string;
  category: string;
};

type LeaderboardEntry = {
  agent_name: string;
  messages_sent: number;
  replies: number;
  deals: number;
  revenue_cents: number;
  reply_rate: number;
};

type ActivityTargets = {
  sms_sent: number;
  sms_target: number;
  email_sent: number;
  email_target: number;
  followups_sent: number;
  followups_target: number;
  replies_handled: number;
  replies_pending: number;
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AgentDashboard({ agentId }: { agentId: string }) {
  const [data,         setData]         = useState<TaskData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<SectionKey>("replies");
  const [flash,        setFlash]        = useState<{ msg: string; ok: boolean } | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [session,      setSession]      = useState<SessionStats>({ sent: 0, deals: 0, revenue: 0 });
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [replies,      setReplies]      = useState<Reply[]>([]);
  const [replyDraft,   setReplyDraft]   = useState<Record<string, string>>({});
  const [leaderboard,  setLeaderboard]  = useState<LeaderboardEntry[]>([]);
  const [activity,     setActivity]     = useState<ActivityTargets>({
    sms_sent: 0, sms_target: 30,
    email_sent: 0, email_target: 20,
    followups_sent: 0, followups_target: 10,
    replies_handled: 0, replies_pending: 0,
  });

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/sales/todays-tasks");
      const json = await res.json();
      setData(json);
      // Auto-navigate to first non-empty section
      const order: SectionKey[] = ["replies", "followups", "texts", "emails", "facebook_dms", "group_posts"];
      for (const key of order) {
        if (json.sections?.[key]?.length > 0) {
          setActiveTab(key);
          break;
        }
      }
    } catch {
      // leave data null — error state rendered below
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Load replies (live conversations) ──────────────────────────────────────
  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const res = await fetch("/api/admin/sales/replies");
        if (res.ok) {
          const result = await res.json();
          setReplies(result.replies || []);
        }
      } catch (err) {
        console.error("Failed to fetch replies:", err);
      }
    };
    fetchReplies();
    const interval = setInterval(fetchReplies, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Load leaderboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch("/api/admin/sales/leaderboard");
        if (res.ok) {
          const result = await res.json();
          const entries = (result.leaderboard || []).slice(0, 5).map((entry: any) => ({
            agent_name: entry.name,
            messages_sent: entry.messages || 0,
            replies: entry.replies || 0,
            deals: entry.deals || 0,
            revenue_cents: entry.revenue_cents || 0,
            reply_rate: entry.reply_rate || 0,
          }));
          setLeaderboard(entries);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      }
    };
    fetchLeaderboard();
  }, []);

  // ── Flash helper ──────────────────────────────────────────────────────────
  const showFlash = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  };

  // ── Mark task done (remove from list) ─────────────────────────────────────
  const done = (id: string) => setCompletedIds(prev => new Set([...prev, id]));

  // ── Central event logger / sender ─────────────────────────────────────────
  const logEvent = useCallback(async (payload: {
    action_type:    string;
    lead_id?:       string | null;
    channel?:       string | null;
    message?:       string | null;
    subject?:       string | null;
    revenue_cents?: number | null;
  }) => {
    const res = await fetch("/api/admin/sales/event", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ agent_id: agentId, ...payload }),
    });
    return res.json() as Promise<{ error?: string; sent?: boolean }>;
  }, [agentId]);

  // ── Action handlers ───────────────────────────────────────────────────────

  const sendSms = async (lead: Lead, message: string, taskId: string) => {
    const r = await logEvent({ action_type: "text_sent", lead_id: lead.id, channel: "sms", message });
    if (r.error) { showFlash(`Failed: ${r.error}`, false); return; }
    showFlash(`✓ Text sent to ${lead.business_name}`);
    done(taskId);
    setSession(s => ({ ...s, sent: s.sent + 1 }));
  };

  const sendEmail = async (lead: Lead, message: string, subject: string, taskId: string) => {
    const r = await logEvent({ action_type: "email_sent", lead_id: lead.id, channel: "email", message, subject });
    if (r.error) { showFlash(`Failed: ${r.error}`, false); return; }
    showFlash(`✓ Email sent to ${lead.business_name}`);
    done(taskId);
    setSession(s => ({ ...s, sent: s.sent + 1 }));
  };

  const markFbSent = async (lead: Lead, message: string, taskId: string) => {
    await logEvent({ action_type: "facebook_sent", lead_id: lead.id, channel: "facebook", message });
    showFlash(`✓ FB DM logged for ${lead.business_name}`);
    done(taskId);
    setSession(s => ({ ...s, sent: s.sent + 1 }));
  };

  const markGroupPosted = async (post: GroupPost) => {
    await logEvent({ action_type: "facebook_sent", channel: "facebook", message: post.post_copy });
    showFlash(`✓ Group post logged`);
    done(post.id);
  };

  const sendFollowUpReply = async (reply: Reply, message: string) => {
    const r = await logEvent({
      action_type: "follow_up_sent",
      lead_id: reply.lead_id,
      channel: reply.channel,
      message,
    });
    if (r.error) {
      showFlash(`Failed: ${r.error}`, false);
      return;
    }
    showFlash(`✓ Reply sent to ${reply.business_name}`);
    setReplies(prev => prev.filter(rep => rep.id !== reply.id));
    setReplyDraft(prev => {
      const next = { ...prev };
      delete next[reply.id];
      return next;
    });
    setSession(s => ({ ...s, sent: s.sent + 1 }));
  };

  const skipLead = async (lead: Lead, taskId: string) => {
    await logEvent({ action_type: "lead_skipped", lead_id: lead.id });
    done(taskId);
  };

  const markBadNumber = async (lead: Lead, taskId: string) => {
    await logEvent({ action_type: "lead_skipped", lead_id: lead.id, channel: "sms" });
    done(taskId);
    showFlash(`Marked bad number — ${lead.business_name}`);
  };

  const markInvalidEmail = async (lead: Lead, taskId: string) => {
    await logEvent({ action_type: "lead_skipped", lead_id: lead.id, channel: "email" });
    done(taskId);
    showFlash(`Marked invalid email — ${lead.business_name}`);
  };

  const closeDeal = async (lead: Lead, taskId: string, revenue: number) => {
    await logEvent({ action_type: "deal_closed", lead_id: lead.id, revenue_cents: revenue * 100 });
    done(taskId);
    setSession(s => ({ ...s, deals: s.deals + 1, revenue: s.revenue + revenue }));
    showFlash(`🎉 DEAL CLOSED — $${revenue}/mo — ${lead.business_name}`);
  };

  // ── City list (derived from all loaded leads) ─────────────────────────────
  const allCities: string[] = data
    ? Array.from(new Set([
        ...data.sections.texts.map(t => t.lead.city ?? ""),
        ...data.sections.emails.map(t => t.lead.city ?? ""),
        ...data.sections.facebook_dms.map(t => t.lead.city ?? ""),
        ...data.sections.followups.map(t => t.lead.city ?? ""),
        ...data.sections.replies.map(t => t.lead.city ?? ""),
      ].filter(Boolean))).sort()
    : [];

  // ── City-filtered sections ─────────────────────────────────────────────────
  const filterCity = <T extends { lead: Lead }>(items: T[]): T[] =>
    selectedCity === "All" ? items : items.filter(t => t.lead.city === selectedCity);

  const filteredSections = data ? {
    replies:      filterCity(data.sections.replies),
    followups:    filterCity(data.sections.followups),
    texts:        filterCity(data.sections.texts),
    emails:       filterCity(data.sections.emails),
    facebook_dms: filterCity(data.sections.facebook_dms),
    group_posts:  selectedCity === "All"
      ? data.sections.group_posts
      : data.sections.group_posts.filter(p => p.city === selectedCity),
  } : null;

  // ── Section counts (exclude completed) ────────────────────────────────────
  const counts: Record<SectionKey, number> = filteredSections
    ? {
        replies:      filteredSections.replies.filter(t => !completedIds.has(t.lead.id + "_reply")).length,
        followups:    filteredSections.followups.filter(t => !completedIds.has(t.lead.id + "_followup")).length,
        texts:        filteredSections.texts.filter(t => !completedIds.has(t.lead.id + "_text")).length,
        emails:       filteredSections.emails.filter(t => !completedIds.has(t.lead.id + "_email")).length,
        facebook_dms: filteredSections.facebook_dms.filter(t => !completedIds.has(t.lead.id + "_fbdm")).length,
        group_posts:  filteredSections.group_posts.filter(t => !completedIds.has(t.id)).length,
      }
    : { replies: 0, followups: 0, texts: 0, emails: 0, facebook_dms: 0, group_posts: 0 };

  const totalRemaining = Object.values(counts).reduce((a, b) => a + b, 0);

  const TABS: { key: SectionKey; label: string; icon: string; urgent: boolean }[] = [
    { key: "replies",      label: "Replies",     icon: "💬", urgent: true  },
    { key: "followups",    label: "Follow-ups",  icon: "🔁", urgent: true  },
    { key: "texts",        label: "Texts",       icon: "📱", urgent: false },
    { key: "emails",       label: "Emails",      icon: "📧", urgent: false },
    { key: "facebook_dms", label: "FB DMs",      icon: "💙", urgent: false },
    { key: "group_posts",  label: "Group Posts", icon: "📢", urgent: false },
  ];

  // ── Loading & error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">Loading today&apos;s tasks…</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Failed to load task queue.</p>
        <button onClick={loadTasks} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const completedTotal = completedIds.size;
  const totalStart     = data.totals.total_tasks;
  const progress       = totalStart > 0 ? Math.min(100, (completedTotal / totalStart) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Flash notification */}
      {flash && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm transition-all ${
          flash.ok ? "bg-green-600" : "bg-red-600"
        }`}>
          {flash.msg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Today&apos;s To-Do</h1>
            <p className="text-sm text-gray-400 mt-0.5">{data.date} · {data.agent.name}</p>
            {/* City filter */}
            {allCities.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">City:</span>
                <select
                  value={selectedCity}
                  onChange={e => setSelectedCity(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All Cities ({allCities.length})</option>
                  {allCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {selectedCity !== "All" && (
                  <button
                    onClick={() => setSelectedCity("All")}
                    className="text-xs text-gray-500 hover:text-white underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-5 text-sm">
            <StatChip label="Remaining" value={totalRemaining}                          color="text-white"     />
            <StatChip label="Sent"      value={data.totals.sent_today + session.sent}   color="text-blue-400"  />
            <StatChip label="Deals"     value={data.totals.deals_today + session.deals} color="text-emerald-400" />
            <StatChip
              label="Rev"
              value={`$${((data.totals.revenue_today_cents / 100) + session.revenue).toFixed(0)}`}
              color="text-emerald-400"
            />
            <button
              onClick={loadTasks}
              className="text-xs text-gray-600 hover:text-gray-300 underline"
            >
              Refresh
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Daily Activity Tracker */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="text-xs font-bold text-gray-400 mb-3">Today's Progress</div>
          <div className="grid grid-cols-4 gap-3">
            <ProgressBar
              label="SMS"
              current={data.totals.sent_today + session.sent}
              target={30}
              icon="📱"
            />
            <ProgressBar
              label="Emails"
              current={data.totals.sent_today + session.sent}
              target={20}
              icon="📧"
            />
            <ProgressBar
              label="Follow-ups"
              current={data.totals.sent_today + session.sent}
              target={10}
              icon="🔁"
            />
            <ProgressBar
              label="Replies"
              current={replies.length}
              target={data.sections.replies.length}
              icon="💬"
            />
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <h3 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">
              <span>🏆</span>
              <span>Today's Leaderboard</span>
            </h3>
            <div className="text-xs overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 px-2 font-bold text-gray-400">Agent</th>
                    <th className="text-right py-2 px-2 font-bold text-gray-400">Sent</th>
                    <th className="text-right py-2 px-2 font-bold text-gray-400">Replies</th>
                    <th className="text-right py-2 px-2 font-bold text-gray-400">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.agent_name} className={`border-b border-gray-800/50 ${entry.agent_name === data.agent.name ? "bg-blue-500/10" : ""}`}>
                      <td className="py-2 px-2 text-gray-300">{entry.agent_name}</td>
                      <td className="text-right py-2 px-2 text-gray-400">{entry.messages_sent}</td>
                      <td className="text-right py-2 px-2 text-gray-400">{entry.replies}</td>
                      <td className="text-right py-2 px-2 text-emerald-400 font-semibold">{entry.deals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Section tabs ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 shrink-0">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => {
            const cnt     = counts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-500 text-white"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {cnt > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab.urgent ? "bg-red-500/25 text-red-300" : "bg-gray-700 text-gray-300"
                  }`}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto">
        {/* Live Conversations Panel */}
        {replies.length > 0 && (
          <div className="mb-6">
            <LiveConversationsPanel
              replies={replies}
              replyDraft={replyDraft}
              onDraftChange={setReplyDraft}
              onSendReply={sendFollowUpReply}
            />
          </div>
        )}

        {activeTab === "replies" && filteredSections && (
          <RepliesSection
            tasks={filteredSections.replies}
            completedIds={completedIds}
            onSendSms={sendSms}
            onSendEmail={sendEmail}
            onDealClosed={closeDeal}
            onSkip={skipLead}
          />
        )}
        {activeTab === "followups" && filteredSections && (
          <FollowUpsSection
            tasks={filteredSections.followups}
            completedIds={completedIds}
            onSendSms={sendSms}
            onSendEmail={sendEmail}
            onSkip={skipLead}
            onDealClosed={closeDeal}
          />
        )}
        {activeTab === "texts" && filteredSections && (
          <TextsSection
            tasks={filteredSections.texts}
            completedIds={completedIds}
            onSend={sendSms}
            onSkip={skipLead}
            onBadNumber={markBadNumber}
          />
        )}
        {activeTab === "emails" && filteredSections && (
          <EmailsSection
            tasks={filteredSections.emails}
            completedIds={completedIds}
            onSend={sendEmail}
            onSkip={skipLead}
            onInvalidEmail={markInvalidEmail}
          />
        )}
        {activeTab === "facebook_dms" && filteredSections && (
          <FbDmsSection
            tasks={filteredSections.facebook_dms}
            completedIds={completedIds}
            onMarkSent={markFbSent}
            onSkip={skipLead}
          />
        )}
        {activeTab === "group_posts" && filteredSections && (
          <GroupPostsSection
            posts={filteredSections.group_posts}
            completedIds={completedIds}
            onMarkPosted={markGroupPosted}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECTION: Replies ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function RepliesSection({
  tasks, completedIds, onSendSms, onSendEmail, onDealClosed, onSkip,
}: {
  tasks:        ReplyTask[];
  completedIds: Set<string>;
  onSendSms:    (lead: Lead, msg: string, id: string) => void;
  onSendEmail:  (lead: Lead, msg: string, sub: string, id: string) => void;
  onDealClosed: (lead: Lead, id: string, rev: number) => void;
  onSkip:       (lead: Lead, id: string) => void;
}) {
  const visible = tasks.filter(t => !completedIds.has(t.lead.id + "_reply"));

  if (visible.length === 0) {
    return <EmptyState icon="💬" message="No replies waiting — you&apos;re all caught up!" />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="💬"
        title="Replies Needing Response"
        subtitle="These leads replied to your outreach. Respond while they&apos;re warm."
        count={visible.length}
        color="red"
      />
      {visible.map(task => (
        <ReplyCard
          key={task.lead.id}
          task={task}
          taskId={task.lead.id + "_reply"}
          onSendSms={onSendSms}
          onSendEmail={onSendEmail}
          onDealClosed={onDealClosed}
          onSkip={onSkip}
        />
      ))}
    </div>
  );
}

function ReplyCard({
  task, taskId, onSendSms, onSendEmail, onDealClosed, onSkip,
}: {
  task:         ReplyTask;
  taskId:       string;
  onSendSms:    (lead: Lead, msg: string, id: string) => void;
  onSendEmail:  (lead: Lead, msg: string, sub: string, id: string) => void;
  onDealClosed: (lead: Lead, id: string, rev: number) => void;
  onSkip:       (lead: Lead, id: string) => void;
}) {
  const { lead } = task;
  const [draft, setDraft]     = useState(task.suggested_response);
  const [rev,   setRev]       = useState("200");
  const [showRev, setShowRev] = useState(false);
  const hasPhone = !!(lead.phone?.trim());
  const hasEmail = !!(lead.email?.trim());
  const subject  = `Re: HomeReach advertising for ${lead.business_name}`;

  return (
    <div className="bg-gray-900 rounded-2xl border border-red-500/30 overflow-hidden shadow-lg">
      <div className="bg-red-900/20 px-5 py-3 flex items-center justify-between border-b border-red-500/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wide">Reply received</span>
            {lead.buying_signal && <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">🔥 HOT</span>}
          </div>
          <h3 className="text-white font-bold text-base mt-0.5">{lead.business_name}</h3>
          {lead.contact_name && <p className="text-gray-400 text-sm">{lead.contact_name}</p>}
        </div>
        <LeadMeta lead={lead} />
      </div>
      <div className="px-5 py-4 space-y-3">
        {task.last_reply_at && (
          <p className="text-xs text-gray-500">
            Replied {new Date(task.last_reply_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-blue-500 resize-none placeholder-gray-600"
        />
        <div className="flex flex-wrap gap-2">
          {hasPhone && (
            <ActionBtn color="green" onClick={() => onSendSms(lead, draft, taskId)}>📱 Reply via Text</ActionBtn>
          )}
          {hasEmail && (
            <ActionBtn color="blue" onClick={() => onSendEmail(lead, draft, subject, taskId)}>📧 Reply via Email</ActionBtn>
          )}
          <ActionBtn color="emerald" onClick={() => setShowRev(v => !v)}>🏆 Close Deal</ActionBtn>
          <ActionBtn color="gray" onClick={() => onSkip(lead, taskId)}>Skip</ActionBtn>
        </div>
        {showRev && (
          <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
            <span className="text-sm text-emerald-300 font-semibold">Deal value:</span>
            <span className="text-white font-bold">$</span>
            <input
              type="number"
              value={rev}
              onChange={e => setRev(e.target.value)}
              className="bg-gray-800 text-white font-bold text-base px-3 py-1 rounded-lg border border-emerald-700 focus:outline-none w-24"
              min="1"
            />
            <span className="text-gray-400 text-sm">/mo</span>
            <button
              onClick={() => onDealClosed(lead, taskId, parseFloat(rev) || 200)}
              className="ml-auto bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-4 py-1.5 rounded-lg text-sm"
            >
              Confirm 🎉
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECTION: Follow-ups ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function FollowUpsSection({
  tasks, completedIds, onSendSms, onSendEmail, onSkip, onDealClosed,
}: {
  tasks:        FollowUpTask[];
  completedIds: Set<string>;
  onSendSms:    (lead: Lead, msg: string, id: string) => void;
  onSendEmail:  (lead: Lead, msg: string, sub: string, id: string) => void;
  onSkip:       (lead: Lead, id: string) => void;
  onDealClosed: (lead: Lead, id: string, rev: number) => void;
}) {
  const visible = tasks.filter(t => !completedIds.has(t.lead.id + "_followup"));

  if (visible.length === 0) {
    return <EmptyState icon="🔁" message="No follow-ups due — you&apos;re on top of it!" />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="🔁"
        title="Follow-ups Due Today"
        subtitle="These leads need a follow-up message. Overdue ones are marked in red."
        count={visible.length}
        color="orange"
      />
      {visible.map(task => (
        <FollowUpCard
          key={task.lead.id}
          task={task}
          taskId={task.lead.id + "_followup"}
          onSendSms={onSendSms}
          onSendEmail={onSendEmail}
          onSkip={onSkip}
          onDealClosed={onDealClosed}
        />
      ))}
    </div>
  );
}

function FollowUpCard({
  task, taskId, onSendSms, onSendEmail, onSkip, onDealClosed,
}: {
  task:         FollowUpTask;
  taskId:       string;
  onSendSms:    (lead: Lead, msg: string, id: string) => void;
  onSendEmail:  (lead: Lead, msg: string, sub: string, id: string) => void;
  onSkip:       (lead: Lead, id: string) => void;
  onDealClosed: (lead: Lead, id: string, rev: number) => void;
}) {
  const { lead, channel, days_since, overdue, draft } = task;
  const [body, setBody]       = useState(draft.body);
  const [subj, setSubj]       = useState(draft.subject ?? `Following up — ${lead.business_name}`);
  const [rev,  setRev]        = useState("200");
  const [showRev, setShowRev] = useState(false);

  return (
    <div className={`bg-gray-900 rounded-2xl border overflow-hidden shadow-lg ${overdue ? "border-orange-500/40" : "border-gray-700"}`}>
      <div className={`px-5 py-3 flex items-center justify-between border-b ${overdue ? "bg-orange-900/15 border-orange-500/20" : "bg-gray-800/40 border-gray-700"}`}>
        <div>
          <div className="flex items-center gap-2">
            {overdue && <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">Overdue</span>}
            <span className="text-xs text-gray-500">{days_since}d since last contact · via {channel.toUpperCase()}</span>
          </div>
          <h3 className="text-white font-bold text-base mt-0.5">{lead.business_name}</h3>
          {lead.contact_name && <p className="text-gray-400 text-sm">{lead.contact_name}</p>}
        </div>
        <LeadMeta lead={lead} />
      </div>
      <div className="px-5 py-4 space-y-3">
        {channel === "email" && (
          <input
            type="text"
            value={subj}
            onChange={e => setSubj(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
            placeholder="Subject line..."
          />
        )}
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={channel === "sms" ? 3 : 6}
          className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-blue-500 resize-none"
        />
        <div className="flex flex-wrap gap-2">
          {channel === "sms"
            ? <ActionBtn color="green" onClick={() => onSendSms(lead, body, taskId)}>📱 Send Follow-up Text</ActionBtn>
            : <ActionBtn color="blue" onClick={() => onSendEmail(lead, body, subj, taskId)}>📧 Send Follow-up Email</ActionBtn>
          }
          <ActionBtn color="emerald" onClick={() => setShowRev(v => !v)}>🏆 Close Deal</ActionBtn>
          <ActionBtn color="gray" onClick={() => onSkip(lead, taskId)}>Skip</ActionBtn>
        </div>
        {showRev && (
          <div className="flex items-center gap-3 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
            <span className="text-sm text-emerald-300 font-semibold">Deal value:</span>
            <span className="text-white font-bold">$</span>
            <input
              type="number" value={rev} onChange={e => setRev(e.target.value)}
              className="bg-gray-800 text-white font-bold text-base px-3 py-1 rounded-lg border border-emerald-700 focus:outline-none w-24" min="1"
            />
            <span className="text-gray-400 text-sm">/mo</span>
            <button
              onClick={() => onDealClosed(lead, taskId, parseFloat(rev) || 200)}
              className="ml-auto bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-4 py-1.5 rounded-lg text-sm"
            >
              Confirm 🎉
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECTION: Texts ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function TextsSection({
  tasks, completedIds, onSend, onSkip, onBadNumber,
}: {
  tasks:        TextTask[];
  completedIds: Set<string>;
  onSend:       (lead: Lead, msg: string, id: string) => void;
  onSkip:       (lead: Lead, id: string) => void;
  onBadNumber:  (lead: Lead, id: string) => void;
}) {
  const visible = tasks.filter(t => !completedIds.has(t.lead.id + "_text"));

  if (visible.length === 0) {
    return <EmptyState icon="📱" message="No texts queued — great work!" />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="📱"
        title="Texts to Send"
        subtitle="Outbound SMS to new leads. Message is pre-written and editable."
        count={visible.length}
        color="green"
      />
      {visible.map(task => (
        <TextCard
          key={task.lead.id}
          task={task}
          taskId={task.lead.id + "_text"}
          onSend={onSend}
          onSkip={onSkip}
          onBadNumber={onBadNumber}
        />
      ))}
    </div>
  );
}

function TextCard({
  task, taskId, onSend, onSkip, onBadNumber,
}: {
  task:        TextTask;
  taskId:      string;
  onSend:      (lead: Lead, msg: string, id: string) => void;
  onSkip:      (lead: Lead, id: string) => void;
  onBadNumber: (lead: Lead, id: string) => void;
}) {
  const { lead } = task;
  const [draft, setDraft] = useState(task.draft.body);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-md">
      <div className="bg-gray-800/40 px-5 py-3 flex items-center justify-between border-b border-gray-700">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {lead.buying_signal && <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">🔥 HOT</span>}
            <span className="text-xs text-gray-500">Score {lead.score} · {lead.category}</span>
          </div>
          <h3 className="text-white font-bold text-base">{lead.business_name}</h3>
          <p className="text-gray-400 text-xs">{lead.phone} · {lead.city}</p>
        </div>
        <LeadMeta lead={lead} />
      </div>
      <div className="px-5 py-4 space-y-3">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-green-500 resize-none"
          maxLength={320}
        />
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <ActionBtn color="green" onClick={() => onSend(lead, draft, taskId)}>📱 Send Text</ActionBtn>
            <ActionBtn color="gray"  onClick={() => onSkip(lead, taskId)}>Skip</ActionBtn>
            <ActionBtn color="red"   onClick={() => onBadNumber(lead, taskId)}>Bad Number</ActionBtn>
          </div>
          <span className="text-xs text-gray-600">{draft.length}/320</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECTION: Emails ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function EmailsSection({
  tasks, completedIds, onSend, onSkip, onInvalidEmail,
}: {
  tasks:          EmailTask[];
  completedIds:   Set<string>;
  onSend:         (lead: Lead, msg: string, sub: string, id: string) => void;
  onSkip:         (lead: Lead, id: string) => void;
  onInvalidEmail: (lead: Lead, id: string) => void;
}) {
  const visible = tasks.filter(t => !completedIds.has(t.lead.id + "_email"));
  const [bulkSending, setBulkSending] = useState(false);

  const sendAll = async () => {
    setBulkSending(true);
    for (const task of visible.slice(0, 20)) {
      onSend(task.lead, task.draft.body, task.draft.subject, task.lead.id + "_email");
      await new Promise(r => setTimeout(r, 400));
    }
    setBulkSending(false);
  };

  if (visible.length === 0) {
    return <EmptyState icon="📧" message="No emails queued — inbox zero!" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <SectionHeader
          icon="📧"
          title="Emails to Send"
          subtitle="Outbound emails to new leads. Subject and body are editable."
          count={visible.length}
          color="blue"
        />
        {visible.length > 1 && (
          <button
            onClick={sendAll}
            disabled={bulkSending}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
          >
            {bulkSending ? "Sending…" : `📧 Send All (${Math.min(visible.length, 20)})`}
          </button>
        )}
      </div>
      {visible.map(task => (
        <EmailCard
          key={task.lead.id}
          task={task}
          taskId={task.lead.id + "_email"}
          onSend={onSend}
          onSkip={onSkip}
          onInvalidEmail={onInvalidEmail}
        />
      ))}
    </div>
  );
}

function EmailCard({
  task, taskId, onSend, onSkip, onInvalidEmail,
}: {
  task:           EmailTask;
  taskId:         string;
  onSend:         (lead: Lead, msg: string, sub: string, id: string) => void;
  onSkip:         (lead: Lead, id: string) => void;
  onInvalidEmail: (lead: Lead, id: string) => void;
}) {
  const { lead } = task;
  const [subj,     setSubj]     = useState(task.draft.subject);
  const [body,     setBody]     = useState(task.draft.body);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-md">
      <div className="bg-gray-800/40 px-5 py-3 flex items-center justify-between border-b border-gray-700">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {lead.buying_signal && <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">🔥 HOT</span>}
            <span className="text-xs text-gray-500">Score {lead.score} · {lead.category}</span>
          </div>
          <h3 className="text-white font-bold text-base">{lead.business_name}</h3>
          <p className="text-gray-400 text-xs">{lead.email} · {lead.city}</p>
        </div>
        <div className="flex items-center gap-2">
          <LeadMeta lead={lead} />
          <button onClick={() => setExpanded(v => !v)} className="text-xs text-gray-500 hover:text-gray-300">
            {expanded ? "▲ Less" : "▼ Edit"}
          </button>
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        {expanded ? (
          <>
            <input
              type="text" value={subj} onChange={e => setSubj(e.target.value)}
              className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
              placeholder="Subject..."
            />
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              rows={8}
              className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
          </>
        ) : (
          <div className="text-xs text-gray-500 bg-gray-800/50 px-3 py-2 rounded-lg truncate">
            <span className="text-gray-400 font-medium">Subject: </span>{subj}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <ActionBtn color="blue" onClick={() => onSend(lead, body, subj, taskId)}>📧 Send Email</ActionBtn>
          <ActionBtn color="gray" onClick={() => onSkip(lead, taskId)}>Skip</ActionBtn>
          <ActionBtn color="red"  onClick={() => onInvalidEmail(lead, taskId)}>Invalid Email</ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECTION: Facebook DMs ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function FbDmsSection({
  tasks, completedIds, onMarkSent, onSkip,
}: {
  tasks:        FbDmTask[];
  completedIds: Set<string>;
  onMarkSent:   (lead: Lead, msg: string, id: string) => void;
  onSkip:       (lead: Lead, id: string) => void;
}) {
  const visible = tasks.filter(t => !completedIds.has(t.lead.id + "_fbdm"));

  if (visible.length === 0) {
    return <EmptyState icon="💙" message="No Facebook DMs queued!" />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="💙"
        title="Facebook DMs"
        subtitle="Copy the pre-written message, open their Facebook page, paste and send."
        count={visible.length}
        color="indigo"
      />
      {visible.map(task => (
        <FbDmCard
          key={task.lead.id}
          task={task}
          taskId={task.lead.id + "_fbdm"}
          onMarkSent={onMarkSent}
          onSkip={onSkip}
        />
      ))}
    </div>
  );
}

function FbDmCard({
  task, taskId, onMarkSent, onSkip,
}: {
  task:       FbDmTask;
  taskId:     string;
  onMarkSent: (lead: Lead, msg: string, id: string) => void;
  onSkip:     (lead: Lead, id: string) => void;
}) {
  const { lead } = task;
  const [draft,  setDraft]  = useState(task.draft.body);
  const [copied, setCopied] = useState(false);

  const copyDm = () => {
    navigator.clipboard.writeText(draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-md">
      <div className="bg-gray-800/40 px-5 py-3 flex items-center justify-between border-b border-gray-700">
        <div>
          <h3 className="text-white font-bold text-base">{lead.business_name}</h3>
          <p className="text-gray-400 text-xs">{lead.city} · {lead.category}</p>
        </div>
        <div className="flex items-center gap-2">
          {lead.facebook_url && (
            <a
              href={lead.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold"
            >
              Open Facebook ↗
            </a>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500 resize-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyDm}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
              copied ? "bg-green-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {copied ? "✓ Copied!" : "Copy DM"}
          </button>
          <ActionBtn color="green" onClick={() => onMarkSent(lead, draft, taskId)}>✓ Mark Sent</ActionBtn>
          <ActionBtn color="gray"  onClick={() => onSkip(lead, taskId)}>No Page Found</ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECTION: Group Posts ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function GroupPostsSection({
  posts, completedIds, onMarkPosted,
}: {
  posts:        GroupPost[];
  completedIds: Set<string>;
  onMarkPosted: (post: GroupPost) => void;
}) {
  const visible = posts.filter(p => !completedIds.has(p.id));

  if (visible.length === 0) {
    return <EmptyState icon="📢" message="All group posts done for today!" />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon="📢"
        title="Facebook Group Posts"
        subtitle="Copy the post, paste into each Facebook group, then mark as posted."
        count={visible.length}
        color="purple"
      />
      {visible.map(post => (
        <GroupPostCard key={post.id} post={post} onMarkPosted={onMarkPosted} />
      ))}
    </div>
  );
}

function GroupPostCard({ post, onMarkPosted }: { post: GroupPost; onMarkPosted: (p: GroupPost) => void }) {
  const [copy,    setCopy]    = useState(post.post_copy);
  const [copied,  setCopied]  = useState(false);

  const copyPost = () => {
    navigator.clipboard.writeText(copy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden shadow-md">
      <div className="bg-gray-800/40 px-5 py-3 border-b border-gray-700">
        <h3 className="text-white font-bold text-base">{post.group_name}</h3>
        <p className="text-gray-400 text-xs">{post.city}</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        <textarea
          value={copy}
          onChange={e => setCopy(e.target.value)}
          rows={4}
          className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-purple-500 resize-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyPost}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
              copied ? "bg-green-600 text-white" : "bg-purple-600 hover:bg-purple-500 text-white"
            }`}
          >
            {copied ? "✓ Copied!" : "Copy Post"}
          </button>
          <ActionBtn color="green" onClick={() => onMarkPosted(post)}>✓ Mark Posted</ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── LIVE CONVERSATIONS PANEL ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function LiveConversationsPanel({
  replies,
  replyDraft,
  onDraftChange,
  onSendReply,
}: {
  replies: Reply[];
  replyDraft: Record<string, string>;
  onDraftChange: (drafts: Record<string, string>) => void;
  onSendReply: (reply: Reply, message: string) => void;
}) {
  if (replies.length === 0) {
    return <EmptyState icon="💬" message="No new replies in the last 24 hours" />;
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-emerald-500/30 overflow-hidden shadow-lg">
      <div className="bg-emerald-900/20 px-5 py-3 border-b border-emerald-500/20 flex items-center gap-2">
        <span className="text-base">💬</span>
        <span className="flex-1 font-bold text-white">Live Conversations</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-emerald-400 font-semibold">{replies.length} new</span>
        </div>
      </div>
      <div className="divide-y divide-gray-800">
        {replies.map((reply) => (
          <div key={reply.id} className="p-4 hover:bg-gray-800/50 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h4 className="text-white font-bold text-sm">{reply.business_name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    reply.channel === "sms"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-blue-500/20 text-blue-300"
                  }`}>
                    {reply.channel === "sms" ? "📱 SMS" : "📧 Email"}
                  </span>
                  {reply.city && <span className="text-xs text-gray-500">{reply.city}</span>}
                  {reply.category && <span className="text-xs text-gray-500">{reply.category}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-500">
                  {new Date(reply.received_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 mb-3 border border-gray-700">
              <p className="text-sm text-gray-300">{reply.message}</p>
            </div>
            <div className="space-y-2">
              <textarea
                value={replyDraft[reply.id] || ""}
                onChange={(e) =>
                  onDraftChange({ ...replyDraft, [reply.id]: e.target.value })
                }
                placeholder="Type your reply..."
                rows={2}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-emerald-500 resize-none placeholder-gray-600"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    onSendReply(reply, replyDraft[reply.id] || "Thanks for reaching out!")
                  }
                  disabled={!replyDraft[reply.id]}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Shared sub-components ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold text-sm ${color}`}>{value}</span>
      <span className="text-gray-600 text-xs">{label}</span>
    </div>
  );
}

function ProgressBar({ label, current, target, icon }: { label: string; current: number; target: number; icon: string }) {
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  let colorClass = "bg-gray-600";
  if (percent >= 100) {
    colorClass = "bg-emerald-500";
  } else if (percent >= 50) {
    colorClass = "bg-yellow-500";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">{icon} {label}</span>
        <span className="text-xs font-bold text-gray-300">{current}/{target}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SectionHeader({
  icon, title, subtitle, count, color,
}: {
  icon:     string;
  title:    string;
  subtitle: string;
  count:    number;
  color:    "red" | "orange" | "green" | "blue" | "indigo" | "purple";
}) {
  const badge: Record<string, string> = {
    red:    "bg-red-500/20 text-red-300",
    orange: "bg-orange-500/20 text-orange-300",
    green:  "bg-green-500/20 text-green-300",
    blue:   "bg-blue-500/20 text-blue-300",
    indigo: "bg-indigo-500/20 text-indigo-300",
    purple: "bg-purple-500/20 text-purple-300",
  };
  return (
    <div className="flex items-start gap-3 mb-1">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge[color]}`}>{count}</span>
        </div>
        <p className="text-gray-500 text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function ActionBtn({
  children, onClick, color,
}: {
  children: React.ReactNode;
  onClick:  () => void;
  color:    "green" | "blue" | "gray" | "red" | "emerald" | "indigo" | "purple";
}) {
  const styles: Record<string, string> = {
    green:   "bg-green-700 hover:bg-green-600 text-white",
    blue:    "bg-blue-700 hover:bg-blue-600 text-white",
    gray:    "bg-gray-700 hover:bg-gray-600 text-gray-300",
    red:     "bg-red-900/50 hover:bg-red-800/70 text-red-300",
    emerald: "bg-emerald-700 hover:bg-emerald-600 text-white",
    indigo:  "bg-indigo-700 hover:bg-indigo-600 text-white",
    purple:  "bg-purple-700 hover:bg-purple-600 text-white",
  };
  return (
    <button
      onClick={onClick}
      className={`text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 ${styles[color]}`}
    >
      {children}
    </button>
  );
}

function LeadMeta({ lead }: { lead: Lead }) {
  return (
    <div className="text-right shrink-0">
      <div className="text-xl font-bold text-white">{lead.score}</div>
      <div className="text-xs text-gray-600">score</div>
      {lead.city && <div className="text-xs text-gray-500">{lead.city}</div>}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <span className="text-5xl">{icon}</span>
      <p className="text-gray-400 text-base font-medium">{message}</p>
    </div>
  );
}
