"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AlertPreferences {
  phone: string;
  quiet_hours_start: number;
  quiet_hours_end:   number;
  max_per_hour:      number;
  urgent_override:   boolean;
  enabled:           boolean;
  enabled_types:     string[];
}

const ALL_ALERT_TYPES = [
  { type: "hot_lead",          label: "Hot Lead Alerts",         icon: "🔥" },
  { type: "reply_waiting",     label: "Reply Waiting Alerts",    icon: "💬" },
  { type: "payment_follow_up", label: "Payment Follow-Up",       icon: "💳" },
  { type: "start_of_day",      label: "Start of Day Brief",      icon: "☀️" },
  { type: "quota_warning",     label: "Quota Warning",           icon: "⚠️" },
];

export default function AccountPage() {
  const router = useRouter();
  const [prefs,   setPrefs]   = useState<AlertPreferences | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [phone,   setPhone]   = useState("");
  const [user,    setUser]    = useState<{ email?: string; full_name?: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/agent/preferences").then(r => r.json()).catch(() => null),
      fetch("/api/auth/me").then(r => r.json()).catch(() => null),
    ]).then(([prefData, userData]) => {
      if (prefData?.preferences) {
        setPrefs(prefData.preferences);
        setPhone(prefData.preferences.phone ?? "");
      } else if (prefData?.defaults_applied) {
        // No saved prefs yet — use defaults
        setPrefs({
          phone:               "",
          quiet_hours_start:   21,
          quiet_hours_end:     7,
          max_per_hour:        3,
          urgent_override:     true,
          enabled:             true,
          enabled_types:       ["hot_lead", "reply_waiting", "payment_follow_up", "start_of_day"],
        });
      }
      if (userData?.user) setUser(userData.user);
    }).finally(() => setLoading(false));
  }, []);

  const toggleType = (type: string) => {
    if (!prefs) return;
    const types = prefs.enabled_types.includes(type)
      ? prefs.enabled_types.filter(t => t !== type)
      : [...prefs.enabled_types, type];
    setPrefs({ ...prefs, enabled_types: types });
  };

  const savePrefs = async () => {
    if (!prefs || saving) return;
    if (!phone || !phone.startsWith("+")) {
      alert("Phone must be in E.164 format e.g. +13301234567");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/alerts/preferences", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          phone,
          quiet_hours_start: prefs.quiet_hours_start,
          quiet_hours_end:   prefs.quiet_hours_end,
          max_per_hour:      prefs.max_per_hour,
          urgent_override:   prefs.urgent_override,
          enabled:           prefs.enabled,
          enabled_types:     prefs.enabled_types,
        }),
      });
      if (res.ok) setSaved(true);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

  if (loading) return (
    <div className="p-4 pt-8 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-800 rounded w-1/2" />
      <div className="h-24 bg-gray-900 rounded-xl" />
      <div className="h-48 bg-gray-900 rounded-xl" />
    </div>
  );

  return (
    <div className="p-4 space-y-5 pb-10">
      <div className="pt-4">
        <h1 className="text-2xl font-bold">Account</h1>
      </div>

      {/* Profile */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Profile</p>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center text-xl font-bold">
            {(user?.full_name ?? user?.email ?? "A")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{user?.full_name ?? "Agent"}</p>
            <p className="text-sm text-gray-400">{user?.email ?? ""}</p>
          </div>
        </div>
      </div>

      {/* Alert preferences */}
      {prefs && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Alert Preferences</p>
            <button
              onClick={() => prefs && setPrefs({ ...prefs, enabled: !prefs.enabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${prefs.enabled ? "bg-blue-600" : "bg-gray-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${prefs.enabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {prefs.enabled && (
            <>
              {/* Phone */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Alert Phone Number (E.164)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+13301234567"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Alert types */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Alert Types</p>
                <div className="space-y-2">
                  {ALL_ALERT_TYPES.map(({ type, label, icon }) => (
                    <label key={type} className="flex items-center justify-between py-1 cursor-pointer">
                      <span className="text-sm text-gray-300">{icon} {label}</span>
                      <button
                        onClick={() => toggleType(type)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${prefs.enabled_types.includes(type) ? "bg-blue-600" : "bg-gray-700"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${prefs.enabled_types.includes(type) ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quiet hours */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Quiet Hours (no alerts)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Start (hour)</label>
                    <input
                      type="number" min={0} max={23}
                      value={prefs.quiet_hours_start}
                      onChange={e => setPrefs({ ...prefs, quiet_hours_start: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End (hour)</label>
                    <input
                      type="number" min={0} max={23}
                      value={prefs.quiet_hours_end}
                      onChange={e => setPrefs({ ...prefs, quiet_hours_end: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 mt-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-1">Uses Ohio time (EST). Critical/High urgency bypasses quiet hours.</p>
              </div>

              {/* Max per hour */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Max Alerts Per Hour</label>
                <input
                  type="number" min={1} max={10}
                  value={prefs.max_per_hour}
                  onChange={e => setPrefs({ ...prefs, max_per_hour: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {saved && (
            <p className="text-emerald-400 text-sm text-center">✅ Preferences saved!</p>
          )}

          <button
            onClick={savePrefs}
            disabled={saving}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm active:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Alert Preferences"}
          </button>
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full bg-gray-900 border border-gray-800 text-red-400 rounded-xl py-3 font-semibold text-sm active:bg-gray-800 transition-colors"
      >
        Sign Out
      </button>

      <p className="text-xs text-gray-700 text-center">HomeReach Agent v1.0</p>
    </div>
  );
}
