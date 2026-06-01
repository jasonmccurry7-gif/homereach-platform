"use client";

import { geoMercator, geoPath } from "d3-geo";
import { feature, merge, mesh } from "topojson-client";
import countiesAtlas from "us-atlas/counties-10m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, GeometryObject, MultiPolygon, Polygon, Topology } from "topojson-specification";

const WIDTH = 520;
const HEIGHT = 390;
const OHIO_STATE_FIPS = "39";

const OHIO_COUNTY_NAMES: Record<string, string> = {
  "39001": "Adams",
  "39003": "Allen",
  "39005": "Ashland",
  "39007": "Ashtabula",
  "39009": "Athens",
  "39011": "Auglaize",
  "39013": "Belmont",
  "39015": "Brown",
  "39017": "Butler",
  "39019": "Carroll",
  "39021": "Champaign",
  "39023": "Clark",
  "39025": "Clermont",
  "39027": "Clinton",
  "39029": "Columbiana",
  "39031": "Coshocton",
  "39033": "Crawford",
  "39035": "Cuyahoga",
  "39037": "Darke",
  "39039": "Defiance",
  "39041": "Delaware",
  "39043": "Erie",
  "39045": "Fairfield",
  "39047": "Fayette",
  "39049": "Franklin",
  "39051": "Fulton",
  "39053": "Gallia",
  "39055": "Geauga",
  "39057": "Greene",
  "39059": "Guernsey",
  "39061": "Hamilton",
  "39063": "Hancock",
  "39065": "Hardin",
  "39067": "Harrison",
  "39069": "Henry",
  "39071": "Highland",
  "39073": "Hocking",
  "39075": "Holmes",
  "39077": "Huron",
  "39079": "Jackson",
  "39081": "Jefferson",
  "39083": "Knox",
  "39085": "Lake",
  "39087": "Lawrence",
  "39089": "Licking",
  "39091": "Logan",
  "39093": "Lorain",
  "39095": "Lucas",
  "39097": "Madison",
  "39099": "Mahoning",
  "39101": "Marion",
  "39103": "Medina",
  "39105": "Meigs",
  "39107": "Mercer",
  "39109": "Miami",
  "39111": "Monroe",
  "39113": "Montgomery",
  "39115": "Morgan",
  "39117": "Morrow",
  "39119": "Muskingum",
  "39121": "Noble",
  "39123": "Ottawa",
  "39125": "Paulding",
  "39127": "Perry",
  "39129": "Pickaway",
  "39131": "Pike",
  "39133": "Portage",
  "39135": "Preble",
  "39137": "Putnam",
  "39139": "Richland",
  "39141": "Ross",
  "39143": "Sandusky",
  "39145": "Scioto",
  "39147": "Seneca",
  "39149": "Shelby",
  "39151": "Stark",
  "39153": "Summit",
  "39155": "Trumbull",
  "39157": "Tuscarawas",
  "39159": "Union",
  "39161": "Van Wert",
  "39163": "Vinton",
  "39165": "Warren",
  "39167": "Washington",
  "39169": "Wayne",
  "39171": "Williams",
  "39173": "Wood",
  "39175": "Wyandot",
};

export type OhioCountyMapCounty = {
  name: string;
  tone?: "primary" | "secondary" | "watch";
};

export type OhioCountyMapCity = {
  name: string;
  lat: number;
  lon: number;
  tone?: "primary" | "secondary" | "watch";
};

const topology = countiesAtlas as unknown as Topology;
const countiesObject = topology.objects.counties as GeometryCollection;
const allCountyFeatures = feature(topology, countiesObject) as FeatureCollection<Geometry>;
const ohioCountyGeometries = countiesObject.geometries.filter(isOhioPolygonGeometry);
const ohioFeatureCollection: FeatureCollection<Geometry, { fips: string; name: string }> = {
  type: "FeatureCollection",
  features: allCountyFeatures.features
    .filter((county) => normalizeFips(county.id).startsWith(OHIO_STATE_FIPS))
    .map((county) => {
      const fips = normalizeFips(county.id);
      return {
        ...county,
        properties: {
          fips,
          name: OHIO_COUNTY_NAMES[fips] ?? fips,
        },
      };
    }),
};

const projection = geoMercator().fitExtent(
  [
    [14, 14],
    [WIDTH - 14, HEIGHT - 26],
  ],
  ohioFeatureCollection,
);
const path = geoPath(projection);
const stateOutlinePath = path(merge(topology, ohioCountyGeometries)) ?? "";
const countyBorderPath =
  path(
    mesh(topology, countiesObject, (a, b) => {
      const aIsOhio = isOhioGeometry(a);
      const bIsOhio = isOhioGeometry(b);
      return a !== b && aIsOhio && bIsOhio;
    }),
  ) ?? "";

const renderedCounties = ohioFeatureCollection.features
  .map((county) => ({
    fips: county.properties.fips,
    name: county.properties.name,
    path: path(county) ?? "",
    centroid: path.centroid(county),
  }))
  .filter((county) => county.path);

export function OhioCountyMap({
  counties,
  title = "Ohio county targeting map",
  cities = [],
  compact = false,
  showHeader = true,
  showLegend = true,
  labelCountyNames,
  party,
}: {
  counties: OhioCountyMapCounty[];
  title?: string;
  cities?: OhioCountyMapCity[];
  compact?: boolean;
  showHeader?: boolean;
  showLegend?: boolean;
  labelCountyNames?: string[];
  party?: string;
}) {
  const partyPalette = party ? partyPaletteFor(party) : null;
  const highlighted = new Map(counties.map((county) => [county.name.toLowerCase(), county.tone ?? "primary"]));
  const labelCountySet = labelCountyNames
    ? new Set(labelCountyNames.map((name) => name.toLowerCase()))
    : null;
  const labelCounties = renderedCounties.filter((county) => {
    const name = county.name.toLowerCase();
    return highlighted.has(name) && (!labelCountySet || labelCountySet.has(name));
  });
  const cityMarkers = cities
    .map((city) => {
      const point = projection([city.lon, city.lat]);
      if (!point) return null;
      return {
        ...city,
        x: point[0],
        y: point[1],
      };
    })
    .filter((city): city is OhioCountyMapCity & { x: number; y: number } => Boolean(city));

  return (
    <figure className={compact ? "rounded-xl border border-white/10 bg-slate-950/80 p-2 shadow-2xl shadow-blue-950/20" : "rounded-lg border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-blue-950/20"}>
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
              Source-backed county geometry
            </div>
            <figcaption className="mt-1 text-sm font-black text-white">{title}</figcaption>
          </div>
          <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase text-emerald-100">
            88 counties
          </div>
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={title}
        className={showHeader ? "mt-3 h-auto w-full overflow-visible" : "h-auto w-full overflow-visible"}
      >
        <rect width={WIDTH} height={HEIGHT} rx="14" fill="#020617" />
        <g opacity="0.35">
          <path d="M26 312 C122 266 166 286 250 238 S402 155 494 108" fill="none" stroke="#38bdf8" strokeWidth="2" />
          <path d="M46 92 C120 138 166 124 229 170 S337 254 474 260" fill="none" stroke="#f87171" strokeWidth="1.6" />
        </g>
        <g>
          {renderedCounties.map((county) => {
            const tone = highlighted.get(county.name.toLowerCase());
            return (
              <path
                key={county.fips}
                d={county.path}
                fill={countyFill(tone, partyPalette)}
                stroke={tone ? "#f8fafc" : "transparent"}
                strokeWidth={tone ? 1.4 : 0}
              >
                <title>{`${county.name} County, Ohio`}</title>
              </path>
            );
          })}
        </g>
        <path d={countyBorderPath} fill="none" stroke="#0f172a" strokeWidth="0.65" opacity="0.72" />
        <path d={stateOutlinePath} fill="none" stroke="#f8fafc" strokeWidth="2.6" />

        {labelCounties.map((county) => {
          const tone = highlighted.get(county.name.toLowerCase());
          return (
            <g key={`${county.fips}-label`} transform={`translate(${county.centroid[0]}, ${county.centroid[1]})`}>
              <circle r={tone === "watch" ? 5.5 : 6.5} fill={tone === "watch" ? countyFill("watch", partyPalette) : "#f8fafc"} />
              <circle r={tone === "secondary" ? 2.4 : 3} fill={countyMarkerFill(tone, partyPalette)} />
            </g>
          );
        })}

        {cityMarkers.map((city) => (
          <g key={`city-${city.name}`} transform={`translate(${city.x}, ${city.y})`}>
            <circle r={city.tone === "watch" ? 4.8 : 5.8} fill={cityMarkerFill(city.tone, partyPalette)} />
            <circle r={2.1} fill="#0f172a" />
            <title>{`${city.name}, Ohio municipal anchor`}</title>
          </g>
        ))}
      </svg>

      {showLegend ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          { label: `${partyPalette?.label ?? "Primary"} counties`, tone: "primary", color: countyFill("primary", partyPalette) },
          { label: "Secondary counties", tone: "secondary", color: countyFill("secondary", partyPalette) },
          { label: "Watch counties", tone: "watch", color: countyFill("watch", partyPalette) },
        ].map((item) => (
          <div key={item.label} className="rounded border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
        </div>
      ) : null}
    </figure>
  );
}

function normalizeFips(id: GeometryObject["id"] | Feature["id"]) {
  return String(id ?? "").padStart(5, "0");
}

function isOhioGeometry(geometry: GeometryObject) {
  return normalizeFips(geometry.id).startsWith(OHIO_STATE_FIPS);
}

function isOhioPolygonGeometry(geometry: GeometryObject): geometry is Polygon | MultiPolygon {
  return isOhioGeometry(geometry) && (geometry.type === "Polygon" || geometry.type === "MultiPolygon");
}

type PartyPalette = {
  id: "democrat" | "republican" | "independent";
  label: string;
  primary: string;
  secondary: string;
  watch: string;
  marker: string;
  city: string;
};

function partyPaletteFor(party: string): PartyPalette {
  const normalized = party.toLowerCase();
  if (normalized.includes("democrat")) {
    return {
      id: "democrat",
      label: "Democratic",
      primary: "#2563eb",
      secondary: "#1d4ed8",
      watch: "#93c5fd",
      marker: "#1e3a8a",
      city: "#60a5fa",
    };
  }
  if (normalized.includes("republican")) {
    return {
      id: "republican",
      label: "Republican",
      primary: "#dc2626",
      secondary: "#b91c1c",
      watch: "#fca5a5",
      marker: "#7f1d1d",
      city: "#f87171",
    };
  }
  return {
    id: "independent",
    label: "Independent",
    primary: "#64748b",
    secondary: "#475569",
    watch: "#cbd5e1",
    marker: "#1e293b",
    city: "#cbd5e1",
  };
}

function countyFill(tone?: OhioCountyMapCounty["tone"], partyPalette?: PartyPalette | null) {
  if (partyPalette) {
    if (tone === "primary") return partyPalette.primary;
    if (tone === "secondary") return partyPalette.secondary;
    if (tone === "watch") return partyPalette.watch;
  }
  if (tone === "primary") return "#2563eb";
  if (tone === "secondary") return "#dc2626";
  if (tone === "watch") return "#f59e0b";
  return "#e2e8f0";
}

function countyMarkerFill(tone?: OhioCountyMapCounty["tone"], partyPalette?: PartyPalette | null) {
  if (partyPalette) {
    if (tone === "watch") return partyPalette.marker;
    return partyPalette.marker;
  }
  return tone === "watch" ? "#92400e" : "#1d4ed8";
}

function cityMarkerFill(tone?: OhioCountyMapCity["tone"], partyPalette?: PartyPalette | null) {
  if (partyPalette) {
    if (tone === "watch") return partyPalette.watch;
    return partyPalette.city;
  }
  return tone === "watch" ? "#fde68a" : "#67e8f9";
}
