import { CloudLightning, Mail, MapPinned, RadioTower } from "lucide-react";

export const metadata = {
  title: "StormReach - HomeReach",
  description: "Severe weather geofence and postcard campaign packages for home service contractors.",
};

export default function StormReachPublicPage() {
  return (
    <main className="bg-slate-950 text-white">
      <section className="min-h-[88vh] border-b border-white/10 px-4 py-10 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">StormReach by HomeReach</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-black tracking-tight md:text-7xl">StormReach</h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-200">
              Severe weather moved through your service area. HomeReach helps contractors review impacted neighborhoods, geofence homeowners, and follow up with targeted postcards.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/contact" className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-black text-slate-950 hover:bg-slate-100">Request a Map</a>
              <a href="/admin/stormreach" className="inline-flex min-h-11 items-center rounded-lg border border-white/20 px-4 text-sm font-black text-white hover:bg-white/10">Admin Command</a>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-slate-950/40">
            <div className="grid h-80 grid-cols-12 grid-rows-8 gap-1 overflow-hidden rounded-lg bg-slate-900 p-2">
              {Array.from({ length: 96 }).map((_, index) => (
                <span
                  key={index}
                  className={`rounded ${index % 19 === 0 ? "bg-red-500" : index % 13 === 0 ? "bg-orange-400" : index % 7 === 0 ? "bg-blue-400" : "bg-slate-800"}`}
                />
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Signal icon={CloudLightning} label="Severe event review" />
              <Signal icon={MapPinned} label="Geofence export" />
              <Signal icon={Mail} label="Approval-ready outreach" />
              <Signal icon={RadioTower} label="Postcard follow-up" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Signal({ icon: Icon, label }: { icon: typeof CloudLightning; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-black text-slate-100">
      <Icon className="h-4 w-4 text-orange-300" aria-hidden="true" />
      {label}
    </div>
  );
}
