"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import QuickCallLog from "./quick-call-log";

const OBJECTIONS: Record<string, string[]> = {
  "Too Expensive": [
    "Less than 10 cents per home per month. One new customer pays for the whole thing.",
    "Compare to Google Ads at $15–50 per click. You get 2,500 homes, flat rate, exclusive.",
    "You're not just paying for reach — you're locking your competitors out of this mailer.",
  ],
  "Bad Timing": [
    "No problem — the spot may not be here when timing is better. I can hold it briefly if that helps.",
    "Month-to-month, no contract. Start when you're ready.",
    "Actually good timing — you'd be in front of homeowners before the busy season hits.",
  ],
  "Not Sure": [
    "Let me send you a sample mailer. Zero commitment — just so you can see exactly what it looks like.",
    "We have businesses running in Wooster, Medina, and Cuyahoga Falls right now. Happy to share results.",
    "The list is verified homeowner addresses — people who actually hire for your services.",
  ],
  "Already Advertising": [
    "This works alongside it — most businesses run us and pull a completely different type of customer.",
    "Physical vs digital is a different audience. Postcards reach homeowners before they start searching.",
    "The difference is the category lock — your competitor can run Google too, not this mailer.",
  ],
  "Not Interested": [
    "No problem. Quick question — is it timing, price, or just not the right fit right now?",
    "Understood. Can I send a one-pager so you have it on file in case things change?",
    "No pressure. I'll check back in 60 days — is there a better season for you?",
  ],
};

const PIPELINE_STAGES = ["Queued","Contacted","Replied","Interested","Pricing","Closed"];
const STAGE_IDX: Record<string, number> = { queued:0, contacted:1, replied:2, interested:3, payment_sent:4, closed:5 };

const TYPE_COLOR: Record<string, string> = {
  reply:"bg-red-500 text-white", deal_alert:"bg-amber-500 text-black",
  do_this_now:"bg-blue-500 text-white", followup:"bg-purple-500 text-white",
  hot:"bg-orange-500 text-white", call:"bg-green-600 text-white",
  text:"bg-sky-600 text-white", email:"bg-indigo-600 text-white", dm:"bg-blue-700 text-white",
};
const TYPE_ICON: Record<string,string> = { reply:"💬",deal_alert:"🏆",do_this_now:"⚡",followup:"🔁",hot:"🔥",call:"📞",text:"📱",email:"📧",dm:"💙" };
const TYPE_LABEL: Record<string,string> = { reply:"REPLY",deal_alert:"DEAL ALERT",do_this_now:"DO THIS NOW",followup:"FOLLOW-UP",hot:"HOT",call:"CALL",text:"TEXT",email:"EMAIL",dm:"DM" };

interface ActionItem {
  id:string; lead_id:string; type:string; business:string; city:string; category:string;
  phone:string|null; email:string|null; facebook_url:string|null;
  label:string; sublabel:string; urgency:string; script:string;
  cta:string; reply_at:string|null; pipeline_stage:string;
}

interface Progress { done:number; target:number; }
interface DailyProgress { texts:Progress; emails:Progress; calls:Progress; dms:Progress; posts:Progress; revenue:number; deals:number; }

export default function AgentHome({ agentId, agentName }: { agentId:string; agentName:string }) {
  const [actions, setActions]   = useState<ActionItem[]>([]);
  const [progress, setProgress] = useState<DailyProgress>({ texts:{done:0,target:20}, emails:{done:0,target:20}, calls:{done:0,target:15}, dms:{done:0,target:20}, posts:{done:0,target:2}, revenue:0, deals:0 });
  const [date, setDate]         = useState("");
  const [cities, setCities]     = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeId, setActiveId] = useState<string|null>(null);
  const [done, setDone]         = useState<Set<string>>(new Set());
  const [flash, setFlash]       = useState<{msg:string;ok:boolean}|null>(null);
  const [showLog, setShowLog]   = useState(false);
  const [objection, setObjection] = useState<string|null>(null);
  const [sending, setSending]   = useState<string|null>(null);
  const [scripts, setScripts]   = useState<Record<string,string[]>>({});
  const [scriptIdx, setScriptIdx] = useState<Record<string,number>>({});

  const toast = (msg:string, ok=true) => { setFlash({msg,ok}); setTimeout(()=>setFlash(null),3000); };

  const load = useCallback(async () => {
    try {
      const [tRes, cRes, sRes, pRes, rRes] = await Promise.all([
        fetch(`/api/admin/sales/todays-tasks?agent_id=${agentId}`),
        fetch(`/api/admin/sales/call-list?agent_id=${agentId}`),
        fetch(`/api/admin/sales/call-stats?agent_id=${agentId}&period=today`),
        fetch(`/api/admin/sales/priority-actions?agent_id=${agentId}`),
        fetch(`/api/admin/sales/at-risk?agent_id=${agentId}`),
      ]);
      const [t,c,s,p,r] = await Promise.all([tRes.json(),cRes.json(),sRes.json(),pRes.json(),rRes.json()]);

      const tot = t?.totals ?? {};
      const cs  = s?.stats  ?? {};
      setProgress({
        texts:  { done: tot.sms_sent_today??0,   target: t?.targets?.sms_daily??20  },
        emails: { done: tot.email_sent_today??0,  target: t?.targets?.email_daily??20 },
        calls:  { done: cs.completed??0,          target: c?.list?.target_calls??15  },
        dms:    { done: tot.fb_sent_today??0,     target: 20 },
        posts:  { done: 0,                        target: 2  },
        revenue: tot.revenue_today_cents??0,
        deals:   tot.deals_today??0,
      });
      setDate(t?.date ?? "");
      setCities(t?.agent?.assigned_cities ?? []);

      const items: ActionItem[] = [];
      let pri = 10000;

      // 1. Replies (CRITICAL)
      for (const rp of t?.sections?.replies ?? []) {
        items.push({ id:`reply_${rp.lead.id}`, lead_id:rp.lead.id, type:"reply",
          business:rp.lead.business_name, city:rp.lead.city??"", category:rp.lead.category??"",
          phone:rp.lead.phone, email:rp.lead.email, facebook_url:rp.lead.facebook_url,
          label:`${rp.lead.business_name} replied — respond now`,
          sublabel:"Speed closes deals. Every minute matters.",
          urgency:"critical", script:rp.suggested_response, cta:"Respond",
          reply_at:rp.last_reply_at, pipeline_stage:rp.lead.status });
        pri--;
      }

      // 2. Priority actions (deal alerts, hot leads, do-this-now)
      for (const pa of p?.actions ?? []) {
        const type = pa.action_type === "hot_lead_no_contact" ? "hot"
          : pa.action_type?.includes("verbal") ? "deal_alert" : "do_this_now";
        items.push({ id:pa.id, lead_id:pa.lead_id, type,
          business:pa.business_name, city:pa.city, category:pa.category,
          phone:pa.phone, email:pa.email, facebook_url:null,
          label:pa.what_to_do, sublabel:pa.why_it_matters,
          urgency:pa.urgency, script:pa.recovery_message??pa.what_to_do,
          cta:pa.cta_label, reply_at:null, pipeline_stage:"interested" });
        pri--;
      }

      // 3. At-risk follow-ups
      for (const ar of r?.at_risk ?? []) {
        items.push({ id:ar.id, lead_id:ar.lead_id, type:"followup",
          business:ar.business_name, city:ar.city, category:ar.category,
          phone:ar.phone, email:ar.email, facebook_url:null,
          label:ar.risk_label, sublabel:`${ar.days_stale}d stale · ${ar.estimated_value}`,
          urgency:ar.days_stale>5?"high":"medium", script:ar.recovery_message,
          cta:ar.phone?"Call":"Send", reply_at:null, pipeline_stage:"contacted" });
        pri--;
      }

      // 4. Follow-ups due
      for (const fu of t?.sections?.followups ?? []) {
        items.push({ id:`fu_${fu.lead.id}`, lead_id:fu.lead.id, type:"followup",
          business:fu.lead.business_name, city:fu.lead.city??"", category:fu.lead.category??"",
          phone:fu.lead.phone, email:fu.lead.email, facebook_url:null,
          label:`Follow up — ${fu.lead.business_name}`, sublabel:`${fu.days_since}d since contact · ${fu.overdue?"OVERDUE":"due"}`,
          urgency:fu.overdue?"high":"medium", script:fu.draft.body,
          cta:fu.channel==="sms"?"Send Text":"Send Email", reply_at:null, pipeline_stage:fu.lead.status });
        pri--;
      }

      // 5. Calls (15)
      for (const l of (c?.leads??[]).slice(0,15)) {
        if ((c?.already_called??[]).includes(l.id)) continue;
        items.push({ id:`call_${l.id}`, lead_id:l.id, type:"call",
          business:l.business_name, city:l.city??"", category:l.category??"",
          phone:l.phone, email:null, facebook_url:null,
          label:l.business_name, sublabel:`${l.city} · ${l.category}`,
          urgency:"normal", script:"", cta:"Call",
          reply_at:null, pipeline_stage:l.status });
        pri--;
      }

      // 6. Texts (20)
      for (const tx of (t?.sections?.texts??[]).slice(0,20)) {
        items.push({ id:`text_${tx.lead.id}`, lead_id:tx.lead.id, type:"text",
          business:tx.lead.business_name, city:tx.lead.city??"", category:tx.lead.category??"",
          phone:tx.lead.phone, email:null, facebook_url:null,
          label:tx.lead.business_name, sublabel:`${tx.lead.city} · ${tx.lead.category}`,
          urgency:"normal", script:tx.draft.body, cta:"Send Text",
          reply_at:null, pipeline_stage:tx.lead.status });
        pri--;
      }

      // 7. Emails (20)
      for (const em of (t?.sections?.emails??[]).slice(0,20)) {
        items.push({ id:`email_${em.lead.id}`, lead_id:em.lead.id, type:"email",
          business:em.lead.business_name, city:em.lead.city??"", category:em.lead.category??"",
          phone:null, email:em.lead.email, facebook_url:null,
          label:em.lead.business_name, sublabel:`${em.lead.city} · ${em.lead.category}`,
          urgency:"normal", script:em.draft.body, cta:"Send Email",
          reply_at:null, pipeline_stage:em.lead.status });
        pri--;
      }

      // 8. DMs (20)
      for (const dm of (t?.sections?.facebook_dms??[]).slice(0,20)) {
        items.push({ id:`dm_${dm.lead.id}`, lead_id:dm.lead.id, type:"dm",
          business:dm.lead.business_name, city:dm.lead.city??"", category:dm.lead.category??"",
          phone:null, email:null, facebook_url:dm.lead.facebook_url,
          label:dm.lead.business_name, sublabel:`${dm.lead.city} · ${dm.lead.category}`,
          urgency:"normal", script:dm.draft.body, cta:"Open DM",
          reply_at:null, pipeline_stage:dm.lead.status });
        pri--;
      }

      setActions(items);
    } catch(e) { console.error("[AgentHome]",e); }
    setLoading(false);
  }, [agentId]);

  useEffect(() => { load(); const iv=setInterval(load,90000); return ()=>clearInterval(iv); }, [load]);

  const loadScripts = async (item: ActionItem) => {
    if (scripts[item.id] || !item.category || !["call","text","email"].includes(item.type)) return;
    try {
      const res = await fetch(`/api/admin/sales/call-scripts?category=${item.category}`);
      const d = await res.json();
      setScripts(prev => ({ ...prev, [item.id]: (d.scripts??[]).map((s:any)=>s.script.replace(/\[CITY\]/g,item.city||"your area")) }));
    } catch {}
  };

  const logEvent = async (item:ActionItem, action_type:string, channel?:string) => {
    setSending(item.id);
    try {
      await fetch("/api/admin/sales/event", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ agent_id:agentId, lead_id:item.lead_id, action_type, channel:channel??(item.phone?"sms":item.email?"email":"facebook"), message:item.script, city:item.city, category:item.category }),
      });
      setDone(prev=>new Set([...prev,item.id]));
      toast(`✓ ${item.business}`);
    } catch { toast("Failed",false); }
    setSending(null);
  };

  const closeDeal = async (item:ActionItem) => {
    setSending(item.id);
    try {
      await fetch("/api/admin/sales/close-deal", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ agent_id:agentId, lead_id:item.lead_id, channel:item.phone?"sms":"email" }),
      });
      setDone(prev=>new Set([...prev,item.id]));
      toast(`🏆 Pricing sent to ${item.business}!`);
    } catch { toast("Failed",false); }
    setSending(null);
  };

  const visible = actions.filter(a=>!done.has(a.id));

  const channels = [
    { key:"texts",  icon:"📱", label:"Texts",  p:progress.texts  },
    { key:"emails", icon:"📧", label:"Emails", p:progress.emails },
    { key:"calls",  icon:"📞", label:"Calls",  p:progress.calls  },
    { key:"dms",    icon:"💬", label:"DMs",    p:progress.dms    },
    { key:"posts",  icon:"📢", label:"Posts",  p:progress.posts  },
  ];

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"/>
        <p className="text-gray-400 text-sm">Loading your execution board…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {flash && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl font-bold text-sm ${flash.ok?"bg-green-600":"bg-red-600"}`}>{flash.msg}</div>}

      {showLog && <QuickCallLog agentId={agentId} onClose={()=>setShowLog(false)} onSaved={()=>{setShowLog(false);toast("✓ Logged");load();}}/>}

      {objection && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={()=>setObjection(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Handle: "{objection}"</p>
            {(OBJECTIONS[objection]??OBJECTIONS["Not Interested"]).map((r,i)=>(
              <div key={i} className="mb-3 bg-gray-800 rounded-xl p-3">
                <p className="text-sm text-gray-200 leading-relaxed">{r}</p>
                <button onClick={()=>{navigator.clipboard.writeText(r);toast("Copied!");}} className="mt-2 text-xs text-blue-400">Copy</button>
              </div>
            ))}
            <button onClick={()=>setObjection(null)} className="w-full mt-2 py-2 bg-gray-800 rounded-xl text-sm text-gray-400">Close</button>
          </div>
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-black text-white text-base leading-tight">{agentName}</h1>
            <p className="text-xs text-gray-500">{date}{cities.length>0&&` · ${cities.slice(0,3).join(" · ")}`}</p>
          </div>
          <div className="flex items-center gap-2">
            {progress.deals>0&&<div className="text-right"><p className="text-xs font-bold text-emerald-400">${(progress.revenue/100).toFixed(0)}</p><p className="text-[10px] text-gray-600">{progress.deals} deal{progress.deals!==1?"s":""}</p></div>}
            <button onClick={()=>setShowLog(true)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">+ Log</button>
            <button onClick={load} className="text-gray-600 hover:text-gray-300 text-xs">↻</button>
          </div>
        </div>

        {/* Daily progress bars */}
        <div className="grid grid-cols-5 gap-1.5">
          {channels.map(ch=>{
            const pct=Math.min(100,(ch.p.done/ch.p.target)*100);
            const ok=ch.p.done>=ch.p.target;
            const half=ch.p.done>=ch.p.target/2;
            return (
              <div key={ch.key} className="flex flex-col items-center gap-1">
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${ok?"bg-emerald-500":half?"bg-amber-500":"bg-red-500"}`} style={{width:`${pct}%`}}/>
                </div>
                <p className={`text-[10px] font-bold ${ok?"text-emerald-400":"text-gray-500"}`}>{ch.icon} {ch.p.done}/{ch.p.target}</p>
              </div>
            );
          })}
        </div>

        {/* Objection quick-access */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
          <span className="text-[10px] text-gray-700 self-center shrink-0">Objections:</span>
          {Object.keys(OBJECTIONS).map(obj=>(
            <button key={obj} onClick={()=>setObjection(obj)} className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-500">
              {obj}
            </button>
          ))}
        </div>
      </div>

      {/* ── ACTION LIST ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
        {visible.length===0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-5xl">🏆</p>
            <p className="text-white font-black text-xl">All caught up!</p>
            <p className="text-gray-500 text-sm text-center px-8">No pending actions. New leads load every 90 seconds.</p>
            <button onClick={load} className="mt-2 bg-blue-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl">Refresh Now</button>
          </div>
        ) : visible.map(item=>(
          <div key={item.id} className={activeId===item.id?"bg-gray-900":"hover:bg-gray-900/30"}>
            {/* Collapsed row */}
            <button className="w-full text-left px-4 py-3.5 flex items-center gap-3"
              onClick={()=>{ setActiveId(activeId===item.id?null:item.id); if(activeId!==item.id) loadScripts(item); }}>
              <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap ${TYPE_COLOR[item.type]??"bg-gray-600 text-white"}`}>
                {TYPE_ICON[item.type]} {TYPE_LABEL[item.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{item.business}</p>
                <p className="text-xs text-gray-500 truncate">{item.city}{item.category&&` · ${item.category}`}</p>
              </div>
              {item.urgency==="critical"&&<span className="text-[10px] text-red-400 font-bold shrink-0">🚨 URGENT</span>}
              {item.urgency==="high"&&<span className="text-[10px] text-amber-400 font-bold shrink-0">⚡</span>}
            </button>

            {/* Expanded */}
            {activeId===item.id&&(
              <div className="px-4 pb-5 space-y-3">
                {/* Pipeline bar */}
                <div className="flex items-center gap-0.5">
                  {PIPELINE_STAGES.map((st,i)=>{
                    const idx=STAGE_IDX[item.pipeline_stage]??0;
                    return (
                      <div key={st} className="flex items-center gap-0.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${i<idx?"bg-blue-500":i===idx?"bg-green-400 ring-2 ring-green-400/30":"bg-gray-700"}`}/>
                        {i<PIPELINE_STAGES.length-1&&<div className={`h-px w-4 ${i<idx?"bg-blue-500":"bg-gray-700"}`}/>}
                      </div>
                    );
                  })}
                  <span className="ml-2 text-[10px] text-gray-500">{PIPELINE_STAGES[STAGE_IDX[item.pipeline_stage]??0]}</span>
                </div>

                {/* Script */}
                {(item.script||(scripts[item.id]??[]).length>0)&&(
                  <div className="bg-gray-800 rounded-xl p-3">
                    {(scripts[item.id]??[]).length>1&&(
                      <div className="flex gap-1 mb-2">
                        {(scripts[item.id]).map((_,i)=>(
                          <button key={i} onClick={()=>setScriptIdx(prev=>({...prev,[item.id]:i}))}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${(scriptIdx[item.id]??0)===i?"bg-blue-600 text-white":"bg-gray-700 text-gray-400"}`}>
                            Script {i+1}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {(scripts[item.id]??[])[scriptIdx[item.id]??0]??item.script}
                    </p>
                    <button onClick={()=>navigator.clipboard.writeText((scripts[item.id]??[])[scriptIdx[item.id]??0]??item.script)} className="mt-1.5 text-xs text-gray-500 hover:text-white">Copy</button>
                  </div>
                )}

                {/* CLOSE THIS DEAL */}
                <button onClick={()=>closeDeal(item)} disabled={sending===item.id}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm rounded-xl disabled:opacity-50">
                  {sending===item.id?"Sending…":"👉 CLOSE THIS DEAL — Send Pricing + Intake Link"}
                </button>

                {/* Primary actions */}
                <div className="flex gap-2">
                  {item.phone&&<a href={`tel:${item.phone}`} onClick={()=>logEvent(item,"text_sent","phone")} className="flex-1 text-center py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl">📞 Call</a>}
                  {item.phone&&<button onClick={()=>logEvent(item,"text_sent","sms")} disabled={sending===item.id} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-50">📱 Text</button>}
                  {item.email&&<button onClick={()=>logEvent(item,"email_sent","email")} disabled={sending===item.id} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50">📧 Email</button>}
                  {item.facebook_url&&<a href={item.facebook_url} target="_blank" rel="noopener noreferrer" onClick={()=>logEvent(item,"facebook_sent","facebook")} className="flex-1 text-center py-2.5 bg-blue-800 hover:bg-blue-700 text-white text-sm font-bold rounded-xl">💬 DM</a>}
                </div>

                {/* Outcome buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[{l:"No Answer",o:"no_answer",c:"bg-gray-700"},{l:"Voicemail",o:"left_voicemail",c:"bg-gray-700"},{l:"Interested!",o:"interested",c:"bg-green-700"},{l:"Wants Info",o:"wants_info",c:"bg-green-800"},{l:"Call Back",o:"call_back_later",c:"bg-amber-700"},{l:"Bad #",o:"bad_number",c:"bg-red-900"},{l:"Not Int.",o:"not_interested",c:"bg-gray-800 border border-gray-600"},{l:"Skip",o:"lead_skipped",c:"bg-gray-900 border border-gray-700"}].map(o=>(
                    <button key={o.o} onClick={()=>logEvent(item,o.o)} disabled={sending===item.id}
                      className={`${o.c} text-white text-xs py-2 rounded-lg font-medium hover:opacity-80 disabled:opacity-40`}>{o.l}</button>
                  ))}
                </div>

                {/* Objection row */}
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-[10px] text-gray-600 self-center">Handle:</span>
                  {Object.keys(OBJECTIONS).map(obj=>(
                    <button key={obj} onClick={()=>setObjection(obj)} className="text-[10px] px-2 py-1 bg-gray-800 text-gray-400 hover:text-white rounded-lg border border-gray-700">{obj}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
