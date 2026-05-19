"use client";

import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { GeometryCollection as TopoGeometryCollection, Topology } from "topojson-specification";
import countiesTopologyRaw from "us-atlas/counties-10m.json";
import statesTopologyRaw from "us-atlas/states-10m.json";
import ohioPoliticalDistrictsRaw from "../_data/ohio-political-districts.json";
import type { CandidateAgentCoverageOption } from "@/lib/political/candidate-coverage-plan";

const OHIO_FIPS = "39";
const VIEWBOX = { width: 420, height: 300 };

type AtlasProperties = GeoJsonProperties & { name?: string };
type AtlasFeature = Feature<Geometry, AtlasProperties> & { id?: string | number };
type DistrictFeatureProperties = { district?: string; id?: number; label?: string };

interface StatePoliticalDistrictData {
  stateKey: string;
  sourceName: string;
  sourceUrl: string;
  sourceCycle: string;
  layers: Partial<Record<
    NonNullable<CandidateAgentCoverageOption["mapHighlight"]["districtLayer"]>,
    {
      label: string;
      sourceUrl: string;
      featureCount: number;
      featureCollection: FeatureCollection<Geometry, DistrictFeatureProperties>;
    }
  >>;
}

interface CandidateCoverageMapPreviewProps {
  option: CandidateAgentCoverageOption;
  selected: boolean;
}

const countiesTopology = countiesTopologyRaw as unknown as Topology;
const statesTopology = statesTopologyRaw as unknown as Topology;
const ohioPoliticalDistricts = ohioPoliticalDistrictsRaw as StatePoliticalDistrictData;
const countiesObject = (countiesTopology.objects as Record<"counties", TopoGeometryCollection>).counties;
const statesObject = (statesTopology.objects as Record<"states", TopoGeometryCollection>).states;

const allCounties = (
  feature(countiesTopology, countiesObject) as unknown as FeatureCollection<Geometry, AtlasProperties>
).features as AtlasFeature[];

const allStates = (
  feature(statesTopology, statesObject) as unknown as FeatureCollection<Geometry, AtlasProperties>
).features as AtlasFeature[];

function normalizeId(id: string | number | undefined, length: number) {
  return String(id ?? "").padStart(length, "0");
}

function normalizeCountyName(value: string) {
  return value
    .toLowerCase()
    .replace(/\bcounty\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function reversePolygonWinding(geometry: Geometry): Geometry {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => [...ring].reverse()),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse())),
    };
  }

  return geometry;
}

function hasUsableProjectedBounds(bounds: [[number, number], [number, number]]) {
  const [[minX, minY], [maxX, maxY]] = bounds;
  const values = [minX, minY, maxX, maxY];

  return (
    values.every(Number.isFinite) &&
    minX > -VIEWBOX.width &&
    minY > -VIEWBOX.height &&
    maxX < VIEWBOX.width * 2 &&
    maxY < VIEWBOX.height * 2 &&
    maxX - minX > 1 &&
    maxY - minY > 1
  );
}

function normalizeDistrictFeatureForProjection(
  districtFeature: Feature<Geometry, DistrictFeatureProperties>,
  path: ReturnType<typeof geoPath>,
) {
  if (hasUsableProjectedBounds(path.bounds(districtFeature))) return districtFeature;

  const rewoundFeature = {
    ...districtFeature,
    geometry: reversePolygonWinding(districtFeature.geometry),
  };

  return hasUsableProjectedBounds(path.bounds(rewoundFeature)) ? rewoundFeature : districtFeature;
}

function buildCoveragePreview(option: CandidateAgentCoverageOption) {
  const ohioCounties = allCounties.filter((county) => normalizeId(county.id, 5).startsWith(OHIO_FIPS));
  const ohioState = allStates.find((state) => normalizeId(state.id, 2) === OHIO_FIPS);
  const fallbackGeometry = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "GeometryCollection",
      geometries: ohioCounties.map((county) => county.geometry),
    },
  } as Feature<Geometry, GeoJsonProperties>;
  const fitGeometry = ohioState ?? fallbackGeometry;
  const projection = geoMercator().fitExtent(
    [
      [18, 18],
      [VIEWBOX.width - 18, VIEWBOX.height - 18],
    ],
    fitGeometry,
  );
  const path = geoPath(projection);
  const highlightedCounties = new Set(option.mapHighlight.countyNames.map(normalizeCountyName));
  const countyRows = ohioCounties.map((county) => {
    const countyName = county.properties?.name ?? `County ${normalizeId(county.id, 5)}`;
    const countyPath = path(county) ?? "";
    const centroid = path.centroid(county) as [number, number];
    const highlighted = highlightedCounties.has(normalizeCountyName(countyName));
    return { countyName, path: countyPath, centroid, highlighted };
  });

  const districtFeature =
    option.mapHighlight.kind === "official_district" &&
    option.mapHighlight.districtLayer &&
    option.mapHighlight.districtNumber
      ? ohioPoliticalDistricts.layers[option.mapHighlight.districtLayer]?.featureCollection.features.find(
          (district) => String(district.properties?.district ?? "") === option.mapHighlight.districtNumber,
        ) ?? null
      : null;

  const normalizedDistrict = districtFeature ? normalizeDistrictFeatureForProjection(districtFeature, path) : null;
  const districtPath = normalizedDistrict ? path(normalizedDistrict) ?? "" : "";
  const districtCentroid = normalizedDistrict ? (path.centroid(normalizedDistrict) as [number, number]) : null;

  return {
    countyRows,
    statePath: ohioState ? path(ohioState) ?? "" : "",
    districtPath,
    districtCentroid,
    highlightedCountyRows: countyRows.filter((county) => county.highlighted),
  };
}

function fillForOption(option: CandidateAgentCoverageOption) {
  if (option.key === "standard") return "#38bdf8";
  if (option.key === "expanded") return "#60a5fa";
  if (option.key === "premium") return "#f59e0b";
  return "#ef4444";
}

function shortLayerLabel(option: CandidateAgentCoverageOption) {
  if (option.mapHighlight.districtLayer === "state_senate") return "State Senate";
  if (option.mapHighlight.districtLayer === "state_house") return "State House";
  if (option.mapHighlight.districtLayer === "congressional") return "Congressional";
  return "County clusters";
}

export function CandidateCoverageMapPreview({ option, selected }: CandidateCoverageMapPreviewProps) {
  const preview = useMemo(() => buildCoveragePreview(option), [option]);
  const accent = fillForOption(option);
  const highlightedCount = preview.highlightedCountyRows.length;
  const hasDistrict = Boolean(preview.districtPath);
  const routeMarkers = hasDistrict
    ? preview.districtCentroid
      ? [preview.districtCentroid]
      : []
    : preview.highlightedCountyRows.slice(0, option.key === "standard" ? 6 : option.key === "expanded" ? 10 : 16).map((county) => county.centroid);

  return (
    <div className={selected ? "rounded-lg border border-blue-300/35 bg-blue-500/10 p-3" : "rounded-lg border border-white/10 bg-slate-950 p-3"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Ohio coverage map
          </div>
          <div className="mt-1 text-sm font-black text-white">{option.mapHighlight.title}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-200">
          {shortLayerLabel(option)}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-white/10 bg-slate-900">
        <svg
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          role="img"
          aria-label={`${option.label} Ohio map preview`}
          className="h-auto w-full"
        >
          <defs>
            <radialGradient id={`coverage-glow-${option.key}`} cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <filter id={`coverage-shadow-${option.key}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#020617" floodOpacity="0.45" />
            </filter>
          </defs>
          <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="#0f172a" />
          <circle cx={VIEWBOX.width / 2} cy={VIEWBOX.height / 2} r="135" fill={`url(#coverage-glow-${option.key})`} />
          {preview.countyRows.map((county) => (
            <path
              key={county.countyName}
              d={county.path}
              fill={county.highlighted ? accent : "#334155"}
              opacity={county.highlighted ? 0.9 : 0.42}
              stroke="#f8fafc"
              strokeOpacity={county.highlighted ? 0.8 : 0.16}
              strokeWidth={county.highlighted ? 0.9 : 0.45}
            />
          ))}
          {preview.districtPath ? (
            <path
              d={preview.districtPath}
              fill={accent}
              opacity="0.82"
              stroke="#fef3c7"
              strokeWidth="2.5"
              filter={`url(#coverage-shadow-${option.key})`}
            />
          ) : null}
          {preview.statePath ? (
            <path d={preview.statePath} fill="none" stroke="#f8fafc" strokeOpacity="0.85" strokeWidth="1.5" />
          ) : null}
          {routeMarkers.map(([x, y], index) => (
            <g key={`${x}-${y}-${index}`}>
              <circle cx={x} cy={y} r={selected ? 6.5 : 5} fill="#020617" opacity="0.55" />
              <circle cx={x} cy={y} r={selected ? 4.5 : 3.6} fill="#f8fafc" />
              <circle cx={x} cy={y} r={selected ? 2.5 : 2} fill={accent} />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-300">
        <div>{option.mapHighlight.summary}</div>
        <div className="rounded-md border border-amber-300/20 bg-amber-500/10 px-2.5 py-2 font-bold text-amber-100">
          {option.mapHighlight.readinessLabel}
        </div>
        <div className="text-slate-500">
          Source: {option.mapHighlight.sourceLabel}
          {highlightedCount > 0 ? ` · ${highlightedCount} counties highlighted` : ""}
          {option.mapHighlight.districtNumber ? ` · District ${option.mapHighlight.districtNumber}` : ""}
        </div>
      </div>
    </div>
  );
}
