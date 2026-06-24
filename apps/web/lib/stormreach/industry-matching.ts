import type { IndustryMatch, ScoredStormEvent, StormEventType } from "./types";

type IndustryRule = {
  industry: string;
  score: number;
  reason: string;
};

export const STORMREACH_INDUSTRY_RULES: Record<StormEventType, IndustryRule[]> = {
  hail: [
    { industry: "Roofing", score: 96, reason: "Hail commonly creates inspection demand for roofs and exterior systems." },
    { industry: "Siding", score: 88, reason: "Siding and exterior trim are visible post-hail inspection categories." },
    { industry: "Gutters", score: 86, reason: "Gutters are frequently checked after hail and wind-driven debris." },
    { industry: "Windows", score: 82, reason: "Window and screen repair demand can rise after larger hail." },
    { industry: "Solar", score: 76, reason: "Solar arrays may need documented visual checks after hail." },
    { industry: "Insurance restoration", score: 84, reason: "Restoration contractors can help homeowners understand repair paths without claim guarantees." },
    { industry: "Exterior remodeling", score: 74, reason: "Exterior remodelers can promote inspection and repair availability." },
  ],
  tornado: [
    { industry: "Roofing", score: 94, reason: "Tornado and tornadic wind events create urgent exterior repair demand." },
    { industry: "Tree removal", score: 92, reason: "Tree and limb removal demand can rise immediately after tornadic storms." },
    { industry: "Fencing", score: 82, reason: "Fences and outdoor structures often need repair after high wind." },
    { industry: "Siding", score: 82, reason: "Siding and exterior cladding are common wind-repair categories." },
    { industry: "Windows", score: 80, reason: "Windows and openings can need repair after debris impact." },
    { industry: "Garage doors", score: 74, reason: "Garage doors are a common wind-damage vulnerability." },
    { industry: "Debris removal", score: 86, reason: "Cleanup demand can appear quickly after severe wind damage." },
    { industry: "Restoration contractors", score: 86, reason: "General restoration teams can help coordinate urgent property repairs." },
  ],
  high_wind: [
    { industry: "Roofing", score: 88, reason: "High wind creates roof, shingle, and flashing inspection demand." },
    { industry: "Tree removal", score: 84, reason: "Wind events can produce downed limbs and blocked driveways." },
    { industry: "Fencing", score: 78, reason: "Fencing repair often follows strong gusts." },
    { industry: "Siding", score: 76, reason: "Siding and exterior trim can loosen after high wind." },
    { industry: "Windows", score: 70, reason: "Wind-driven debris can create window and screen repair demand." },
    { industry: "Garage doors", score: 72, reason: "Garage doors are relevant for wind inspection offers." },
    { industry: "Debris removal", score: 80, reason: "Cleanup operators can respond to post-storm debris needs." },
  ],
  hurricane_tropical_storm: [
    { industry: "Roofing", score: 92, reason: "Tropical systems create broad roof inspection and repair demand." },
    { industry: "Water restoration", score: 92, reason: "Wind-driven rain and flooding can create water cleanup needs." },
    { industry: "Mold remediation", score: 86, reason: "Moisture events can create mold-prevention and remediation demand." },
    { industry: "Window repair", score: 80, reason: "Windows and openings are high-priority storm repair categories." },
    { industry: "Siding", score: 80, reason: "Exterior cladding can be affected by sustained wind." },
    { industry: "Tree service", score: 84, reason: "Tree cleanup demand often follows tropical wind." },
    { industry: "Fencing", score: 76, reason: "Outdoor structures can need quick repair after tropical storms." },
    { industry: "Generator installation", score: 76, reason: "Outage risk can increase generator and backup-power demand." },
    { industry: "Debris removal", score: 86, reason: "Cleanup services are often needed after widespread storm impacts." },
  ],
  flooding: [
    { industry: "Water restoration", score: 96, reason: "Flooding creates immediate water extraction and cleanup demand." },
    { industry: "Mold remediation", score: 90, reason: "Mold risk can rise after moisture intrusion." },
    { industry: "Plumbing", score: 78, reason: "Plumbers can support backups, sump systems, and drainage issues." },
    { industry: "Foundation repair", score: 72, reason: "Foundation and drainage checks are relevant after flood events." },
    { industry: "Flooring", score: 76, reason: "Flooring repair or replacement can follow water intrusion." },
    { industry: "HVAC", score: 70, reason: "Mechanical equipment may need checks after flooding." },
    { industry: "Electrical", score: 74, reason: "Electrical safety checks are relevant after water exposure." },
  ],
  winter_storm_ice: [
    { industry: "HVAC", score: 86, reason: "Cold weather raises heating-service urgency." },
    { industry: "Plumbing", score: 90, reason: "Frozen pipes and water-line problems can rise after ice events." },
    { industry: "Electrical", score: 76, reason: "Power interruptions and safety checks can be relevant after ice." },
    { industry: "Generator installation", score: 78, reason: "Outage risk can create backup-power demand." },
    { industry: "Roof repair", score: 74, reason: "Ice, snow load, and leaks can create roof-service demand." },
    { industry: "Snow removal", score: 80, reason: "Snow and ice events can create immediate removal demand." },
    { industry: "Tree service", score: 76, reason: "Ice accumulation can break limbs and create cleanup demand." },
  ],
  heat_wave: [
    { industry: "HVAC", score: 92, reason: "Heat events raise cooling repair, tune-up, and replacement urgency." },
    { industry: "Insulation", score: 78, reason: "High heat can make comfort and energy-efficiency upgrades more relevant." },
    { industry: "Generator installation", score: 72, reason: "Grid strain and outage risk can increase backup-power interest." },
    { industry: "Electrical", score: 70, reason: "Electrical contractors can support panel, generator, and cooling-load checks." },
    { industry: "Air duct cleaning", score: 66, reason: "Indoor comfort and air movement concerns can make duct work relevant." },
  ],
  wildfire_smoke: [
    { industry: "Restoration", score: 84, reason: "Smoke and ash impacts can create property cleanup demand." },
    { industry: "HVAC", score: 82, reason: "Indoor air and filter concerns make HVAC services relevant." },
    { industry: "Air duct cleaning", score: 84, reason: "Air-quality concerns can increase duct and filter service demand." },
    { industry: "Roofing", score: 72, reason: "Roof and exterior checks may be relevant after ash exposure." },
    { industry: "Exterior cleaning", score: 76, reason: "Ash and residue cleanup can be a practical homeowner need." },
    { industry: "Insurance restoration", score: 72, reason: "Restoration guidance may be helpful without promising claim outcomes." },
  ],
  severe_thunderstorm: [
    { industry: "Roofing", score: 80, reason: "Severe thunderstorms can create roof inspection demand." },
    { industry: "Gutters", score: 74, reason: "Heavy rain and debris can affect gutters." },
    { industry: "Tree removal", score: 72, reason: "Thunderstorm wind can create tree and limb cleanup needs." },
    { industry: "Siding", score: 68, reason: "Exterior components can be affected by severe wind or hail." },
    { industry: "Windows", score: 62, reason: "Wind-driven debris and hail can affect windows or screens." },
  ],
  derecho: [
    { industry: "Roofing", score: 94, reason: "Derechos create widespread high-wind roof inspection demand." },
    { industry: "Tree removal", score: 94, reason: "Widespread wind damage often creates immediate tree-service demand." },
    { industry: "Fencing", score: 82, reason: "Outdoor structures commonly need repair after a derecho." },
    { industry: "Siding", score: 82, reason: "Siding and exterior trim are relevant for post-wind checks." },
    { industry: "Windows", score: 78, reason: "Wind-driven debris can affect windows, screens, and openings." },
    { industry: "Garage doors", score: 76, reason: "Garage doors are a known wind-impact category." },
    { industry: "Debris removal", score: 90, reason: "Cleanup demand can be high after widespread wind events." },
    { industry: "Restoration contractors", score: 86, reason: "Restoration teams can coordinate broader repair needs." },
  ],
  unknown: [
    { industry: "Roofing", score: 55, reason: "Default exterior inspection category when event data is incomplete." },
    { industry: "Restoration contractors", score: 52, reason: "Default storm response category when the event type is uncertain." },
  ],
};

export function normalizeIndustry(industry: string) {
  return industry.trim().replace(/\s+/g, " ");
}

export function matchIndustriesForEvent(
  event: Pick<ScoredStormEvent, "eventType" | "severityLevel" | "severityScore">,
  overrides: string[] = [],
): IndustryMatch[] {
  const rules = STORMREACH_INDUSTRY_RULES[event.eventType] ?? STORMREACH_INDUSTRY_RULES.unknown;
  const severityBoost = event.severityLevel === "Extreme" ? 4 : event.severityLevel === "High" ? 2 : 0;
  const byIndustry = new Map<string, IndustryMatch>();

  for (const rule of rules) {
    const industry = normalizeIndustry(rule.industry);
    byIndustry.set(industry.toLowerCase(), {
      industry,
      matchScore: clamp(rule.score + severityBoost),
      reason: rule.reason,
    });
  }

  for (const override of overrides) {
    const industry = normalizeIndustry(override);
    if (!industry) continue;
    const key = industry.toLowerCase();
    const existing = byIndustry.get(key);
    byIndustry.set(key, {
      industry,
      matchScore: Math.max(existing?.matchScore ?? 0, 92),
      reason: existing?.reason ?? "Admin override added this service category for the event.",
      adminOverride: true,
    });
  }

  return Array.from(byIndustry.values()).sort((a, b) => b.matchScore - a.matchScore || a.industry.localeCompare(b.industry));
}

export function topIndustriesForEvent(event: Pick<ScoredStormEvent, "eventType" | "severityLevel" | "severityScore">, limit = 7) {
  return matchIndustriesForEvent(event).slice(0, limit).map((match) => match.industry);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
