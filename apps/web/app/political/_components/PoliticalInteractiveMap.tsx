"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Database,
  ExternalLink,
  Expand,
  FileDown,
  FileText,
  Flag,
  Landmark,
  Layers3,
  Mail,
  Map as MapIcon,
  Minimize2,
  Radio,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { GeometryCollection as TopoGeometryCollection, Topology } from "topojson-specification";
import countiesTopologyRaw from "us-atlas/counties-10m.json";
import statesTopologyRaw from "us-atlas/states-10m.json";
import illinoisPoliticalDistrictsRaw from "../_data/illinois-political-districts.json";
import ohioPoliticalDistrictsRaw from "../_data/ohio-political-districts.json";
import tennesseePoliticalDistrictsRaw from "../_data/tennessee-political-districts.json";
import {
  MINIMUM_TOTAL_PIECES,
  POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
  POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
  resolvePoliticalPostcardPriceCents,
} from "@/lib/political/pricing-config";

type StateKey = "ohio" | "illinois" | "tennessee";
type PoliticalMode = "county" | "zipcode" | "city" | "district";
type OfficialDistrictLayerKey = "congressional" | "state_senate" | "state_house";
type PartyLean = "democrat" | "republican" | "mixed";
type DataLabel = "Exact" | "Estimated" | "Demo/Sample" | "Public Aggregate" | "Paid Vendor Data" | "Unavailable";
type SaveStatus = "idle" | "saving" | "database" | "local_only" | "error";
type MapActionStatus = "idle" | "working" | "success" | "error";
type HealthTone = "green" | "yellow" | "red";
type WhatIfAction = "set-drops-1" | "set-drops-2" | "set-drops-3" | "expand-gap" | "saturate-top";
type LayerSourceStatus = "ready" | "official" | "public" | "usps" | "internal" | "vendor" | "local" | "planned";

type AtlasProperties = GeoJsonProperties & {
  name?: string;
};

type AtlasFeature = Feature<Geometry, AtlasProperties> & {
  id?: string | number;
};

interface PoliticalUnit {
  id: string;
  label: string;
  mode: PoliticalMode;
  countyIds: string[];
  households: number;
  lean: PartyLean;
  intensity: "light" | "medium" | "strong";
  confidence: DataLabel;
  source: string;
  partisanDataReady: boolean;
  electionMarginPct?: number;
  republicanPct?: number;
  democraticPct?: number;
}

interface CityMarkerSource {
  label: string;
  market: string;
  coordinates: [number, number];
  priority: 1 | 2 | 3;
}

interface CityMarker extends CityMarkerSource {
  id: string;
  unitId: string;
  position: [number, number];
}

interface OfficialDistrictShape {
  id: string;
  unitId: string;
  district: string;
  label: string;
  summary: string;
  layerKey: OfficialDistrictLayerKey;
  layerLabel: string;
  sourceName: string;
  sourceUrl: string;
  path: string;
  centroid: [number, number];
  projectedRings: Array<Array<[number, number]>>;
}

interface OfficialDistrictLayerInfo {
  key: OfficialDistrictLayerKey;
  label: string;
  sourceName: string;
  sourceUrl: string;
  sourceCycle: string;
  featureCount: number;
  available: boolean;
}

interface RouteUnit {
  id: string;
  label: string;
  countyId: string;
  countyName: string;
  zip5: string;
  carrierRouteId: string;
  routeType: "city" | "rural" | "general";
  households: number;
  deliveryPoints: number;
  polygon: string;
  centroid: [number, number];
  confidence: DataLabel;
  overlaps: Record<PoliticalMode, string>;
}

interface CampaignStats {
  households: number;
  deliveryPoints: number;
  totalHouseholds: number;
  coveragePct: number;
  printQuantity: number;
  printCost: number;
  postage: number;
  total: number;
  margin: number;
  confidence: DataLabel;
}

interface CampaignHealth {
  score: number;
  tone: HealthTone;
  label: string;
  summary: string;
  factors: Array<{ label: string; value: string; tone: HealthTone }>;
}

interface OpsRecommendation {
  title: string;
  body: string;
  reason: string;
  tone: "blue" | "gold" | "red" | "green";
}

interface TimelineItem {
  label: string;
  dateLabel: string;
  status: "next" | "ready" | "warning";
  detail: string;
}

interface LiveFeedItem {
  label: string;
  detail: string;
  tone: "blue" | "gold" | "red" | "green";
}

interface WhatIfOption {
  label: string;
  action: WhatIfAction;
  householdDelta: number;
  routeDelta: number;
  drops: number;
  total: number;
  printQuantity: number;
  detail: string;
}

interface MapViewState {
  x: number;
  y: number;
  scale: number;
}

interface MapDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startView: MapViewState;
}

interface PlanReadinessItem {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
  blocksProposal?: boolean;
  blocksCheckout?: boolean;
}

interface ActionFeedback {
  tone: "success" | "warning" | "error";
  title: string;
  body: string;
  checklist?: PlanReadinessItem[];
  href?: string;
  hrefLabel?: string;
}

type MapSearchHit =
  | { kind: "route"; id: string; label: string; detail: string; route: RouteUnit }
  | { kind: "geography"; id: string; label: string; detail: string; unitId: string; mode: PoliticalMode }
  | { kind: "city"; id: string; label: string; detail: string; unitId: string };

const VIEWBOX = { width: 920, height: 640 };
const DEFAULT_MAP_VIEW: MapViewState = { x: 0, y: 0, scale: 1 };
const MIN_MAP_SCALE = 1;
const MAX_MAP_SCALE = 6;
const ILLINOIS_BOUNDARIES_URL = "https://gis1.dot.illinois.gov/arcgis/rest/services/MapBase/ILBoundaries/MapServer";
const ILLINOIS_CONGRESSIONAL_DISTRICTS_URL = `${ILLINOIS_BOUNDARIES_URL}/2`;
const ILLINOIS_HOUSE_DISTRICTS_URL = `${ILLINOIS_BOUNDARIES_URL}/3`;
const ILLINOIS_SENATE_DISTRICTS_URL = `${ILLINOIS_BOUNDARIES_URL}/4`;
const ILLINOIS_TOWNSHIP_URL = `${ILLINOIS_BOUNDARIES_URL}/5`;
const ILLINOIS_TOWNS_URL = `${ILLINOIS_BOUNDARIES_URL}/9`;
const TENNESSEE_LEGISLATIVE_DISTRICTS_URL =
  "https://tnmap.tn.gov/arcgis/rest/services/ADMINISTRATIVE_BOUNDARIES/LEGISLATIVE_DISTRICTS/MapServer";
const TENNESSEE_SENATE_DISTRICTS_URL = `${TENNESSEE_LEGISLATIVE_DISTRICTS_URL}/0`;
const TENNESSEE_HOUSE_DISTRICTS_URL = `${TENNESSEE_LEGISLATIVE_DISTRICTS_URL}/1`;
const TENNESSEE_CONGRESSIONAL_DISTRICTS_URL = `${TENNESSEE_LEGISLATIVE_DISTRICTS_URL}/2`;
const TENNESSEE_COMPTROLLER_REDISTRICTING_URL =
  "https://comptroller.tn.gov/office-functions/pa/gisredistricting/redistricting-and-land-use-maps.html";
const ILLINOIS_ELECTION_RESULTS_URL = "https://www.elections.il.gov/ElectionOperations/ElectionVoteTotals.aspx";
const TENNESSEE_ELECTION_RESULTS_URL = "https://sos.tn.gov/elections/results";
const OHIO_CONGRESSIONAL_DISTRICT_SUMMARIES: Record<string, string> = {
  "1": "Clinton, Warren, and part of Hamilton County",
  "2": "Adams, Athens, Brown, Clermont, Gallia, Hocking, Jackson, Lawrence, Meigs, Morgan, Pike, Ross, Scioto, Vinton, Washington, and part of Perry County",
  "3": "Part of Franklin County",
  "4": "Allen, Auglaize, Champaign, Hardin, Logan, Marion, Mercer, Morrow, Shelby, Union, Van Wert, and parts of Clark, Delaware, and Richland Counties",
  "5": "Crawford, Hancock, Huron, Lorain, Sandusky, Seneca, Wyandot, and parts of Richland and Wood Counties",
  "6": "Belmont, Carroll, Columbiana, Harrison, Jefferson, Tuscarawas, and parts of Holmes, Mahoning, Stark, and Wayne Counties",
  "7": "Ashland, Medina, and parts of Cuyahoga and Wayne Counties",
  "8": "Darke, Preble, and parts of Butler, Hamilton, and Miami Counties",
  "9": "Defiance, Erie, Fulton, Henry, Lucas, Ottawa, Paulding, Williams, and part of Wood County",
  "10": "Greene, Montgomery, and part of Butler County",
  "11": "Part of Cuyahoga County",
  "12": "Coshocton, Fairfield, Guernsey, Knox, Licking, Monroe, Muskingum, Noble, and parts of Delaware, Holmes, and Perry Counties",
  "13": "Summit and parts of Portage and Stark Counties",
  "14": "Ashtabula, Geauga, Lake, Trumbull, and parts of Mahoning and Portage Counties",
  "15": "Fayette, Highland, Madison, Pickaway, and parts of Clark, Franklin, and Miami Counties",
};

const DISTRICT_LAYER_BY_LABEL: Partial<Record<string, OfficialDistrictLayerKey>> = {
  "Congressional District": "congressional",
  "State Senate District": "state_senate",
  "State House District": "state_house",
};

const DISTRICT_LAYER_MODE_BY_LABEL: Partial<Record<string, PoliticalMode>> = {
  "ZIP Code": "zipcode",
  County: "county",
  City: "city",
  Township: "city",
  Village: "city",
  "Congressional District": "district",
  "State Senate District": "district",
  "State House District": "district",
  "Judicial District": "district",
  "Municipal District": "city",
};

const STATES: Record<
  StateKey,
  {
    label: string;
    shortLabel: string;
    fips: string;
    districtCount: number;
    zipSeed: number;
    cityMarkets: string[];
  }
> = {
  ohio: {
    label: "Ohio",
    shortLabel: "OH",
    fips: "39",
    districtCount: 15,
    zipSeed: 430,
    cityMarkets: [
      "Columbus Metro",
      "Cleveland Metro",
      "Cincinnati Metro",
      "Toledo Metro",
      "Akron Corridor",
      "Dayton Metro",
      "Youngstown Valley",
      "Mansfield-Marion",
      "Lima-Findlay Corridor",
      "Sandusky-Erie Coast",
      "Northwest Ohio",
      "Zanesville-Newark Corridor",
      "Southeast Ohio",
      "Southern Ohio",
      "Ohio Valley",
      "Ashtabula-Lake Erie",
      "Rural Ohio",
    ],
  },
  illinois: {
    label: "Illinois",
    shortLabel: "IL",
    fips: "17",
    districtCount: 17,
    zipSeed: 600,
    cityMarkets: [
      "Chicago Metro",
      "Aurora-Joliet Corridor",
      "Rockford Region",
      "Peoria Region",
      "Springfield Region",
      "Champaign-Urbana",
      "Bloomington-Normal",
      "Quad Cities",
      "Metro East",
      "Kankakee-Iroquois",
      "Quincy-Western Illinois",
      "Southern Illinois",
      "Northwest Illinois",
      "Downstate Illinois",
    ],
  },
  tennessee: {
    label: "Tennessee",
    shortLabel: "TN",
    fips: "47",
    districtCount: 9,
    zipSeed: 370,
    cityMarkets: [
      "Nashville Metro",
      "Memphis Metro",
      "Knoxville Metro",
      "Chattanooga Metro",
      "Tri-Cities",
      "Clarksville Region",
      "Jackson Region",
      "Murfreesboro-Franklin Corridor",
      "Cookeville-Cumberland Plateau",
      "Columbia-Shelbyville Corridor",
      "Cleveland-Athens Corridor",
      "Rural Tennessee",
    ],
  },
};

const POLITICAL_LAYERS = [
  {
    group: "Core Geography",
    items: [
      "ZIP Code",
      "County",
      "City",
      "Township",
      "Village",
      "Precinct",
      "Ward",
      "Congressional District",
      "State Senate District",
      "State House District",
      "School Board District",
      "Judicial District",
      "Municipal District",
      "Census Tract",
      "Census Block Group",
      "Neighborhood/Subdivision",
      "Custom Draw Polygon",
      "Radius Targeting",
      "Street-Level Selection",
    ],
  },
  {
    group: "Election and Voting Data",
    items: [
      "Party Registration",
      "Primary Voting History",
      "General Election Voting History",
      "Absentee Voting History",
      "Early Voting History",
      "High Turnout Areas",
      "Low Turnout Areas",
      "Newly Registered Voters",
      "Unaffiliated / Independent Voters",
      "Turnout Percentage by Area",
      "Historical Vote Margin",
      "Historical Republican Percentage",
      "Historical Democrat Percentage",
      "Third Party / Other Percentage",
      "Undervote Areas",
      "Overperforming Precincts",
      "Underperforming Precincts",
      "Vote Growth Trend",
      "Population Growth Trend",
    ],
  },
  {
    group: "Demographic Layers",
    items: [
      "Household Income",
      "Median Home Value",
      "Age Range",
      "Homeownership Percentage",
      "Renters Percentage",
      "Household Size",
      "Education Level",
      "Veteran Households",
      "Seniors 65+",
      "Families with Children",
      "Population Density",
      "New Movers",
      "Length of Residence",
      "Rural / Suburban / Urban",
    ],
  },
  {
    group: "Campaign Operations",
    items: [
      "Volunteer Density",
      "Yard Sign Locations",
      "Canvassing Progress",
      "Knock Completion Percentage",
      "Texting Coverage",
      "Phone Banking Coverage",
      "Literature Drop Progress",
      "Event Attendance Zones",
      "Donor Density",
      "Endorsement Regions",
      "Coalition Support Zones",
    ],
  },
  {
    group: "Performance and ROI",
    items: [
      "QR Scan Heatmaps",
      "Landing Page Conversion Zones",
      "Donation Heatmaps",
      "SMS Engagement Heatmaps",
      "Mail Response Heatmaps",
      "Cost Per Household",
      "Estimated Reach",
      "Estimated Mail Volume",
      "Estimated Print Cost",
      "Estimated Postage",
      "Budget Simulator",
      "Frequency Planner",
    ],
  },
];

const USPS_LAYERS = [
  {
    group: "USPS Geography",
    items: [
      "Carrier Route Overlay",
      "EDDM Route Overlay",
      "ZIP Code",
      "ZIP+4",
      "USPS Delivery Zones",
      "USPS Walk Sequence",
      "Saturation Route",
      "Residential Delivery Points",
      "Business Delivery Points",
      "PO Box Exclusions",
      "Vacant Address Exclusions",
      "Non-Deliverable Address Exclusions",
    ],
  },
  {
    group: "Mail Execution",
    items: [
      "EDDM Eligibility",
      "Saturation Eligibility",
      "Deliverable Address Count",
      "Household Count",
      "Estimated Postage",
      "Estimated Print Cost",
      "Estimated Total Cost",
      "Estimated Delivery Window",
      "Drop Date",
      "Mail Frequency",
      "Number of Drops",
      "Total Pieces Required",
      "Bundle Count",
      "Tray/Sack Estimate",
    ],
  },
  {
    group: "Postal Logistics",
    items: [
      "BMEU Location",
      "SCF Region",
      "NDC Region",
      "Mail Entry Point",
      "Destination Facility",
      "Estimated In-Home Window",
      "Postal Delivery Speed",
      "Route Efficiency",
      "Presort Savings",
      "IMb Tracking Availability",
      "Delivery Confirmation Status",
    ],
  },
  {
    group: "Operational Planning",
    items: [
      "Route Density",
      "Route Efficiency Score",
      "Duplicate Coverage Alert",
      "Overlap Warning",
      "Mail Collision Detection",
      "Drop Scheduling Conflict",
      "Print Deadline",
      "Mail Prep Deadline",
      "BMEU Appointment Deadline",
    ],
  },
];

interface LayerSourceMeta {
  badge: string;
  sourceName: string;
  status: LayerSourceStatus;
  url?: string;
  note: string;
}

const CENSUS_TIGER_URL = "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html";
const CENSUS_TIGER_REST_URL = "https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_restmapservice.html";
const CENSUS_TRACTS_BLOCKS_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer";
const CENSUS_PLACES_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/layers";
const OHIO_SOS_DISTRICT_MAPS_URL = "https://www.ohiosos.gov/elections/district-maps";
const OHIO_SCHOOL_DISTRICTS_URL = "https://maps.ohio.gov/arcgis/rest/services/Hosted/Ohio_School_Districts_2025/FeatureServer/0";
const OHIO_MUNICIPAL_BOUNDARIES_URL = "https://maps.ohio.gov/arcgis/rest/services/Hosted/Ohio_Municipal_Boundaries/FeatureServer/0";
const OHIO_TOWNSHIP_BOUNDARIES_URL = "https://maps.ohio.gov/arcgis/rest/services/Hosted/Ohio_Township_Boundaries/FeatureServer";
const USPS_EDDM_URL = "https://eddm.usps.com/eddm/select-routes.htm";
const USPS_EDDM_BUSINESS_URL = "https://www.usps.com/business/every-door-direct-mail.htm";
const FRANKLIN_BOE_GIS_URL = "https://vote.franklincountyohio.gov/Maps-Data/GIS-Shape-Files";

const DEFAULT_LAYER_SOURCE: LayerSourceMeta = {
  badge: "plan",
  sourceName: "HomeReach source plan",
  status: "planned",
  url: "/political/data-sources",
  note: "Source identified as a future import or internal workflow layer; not production-authoritative yet.",
};

const LAYER_SOURCE_META: Record<string, LayerSourceMeta> = {
  "ZIP Code": {
    badge: "ZCTA",
    sourceName: "U.S. Census TIGER/Line ZCTA plus USPS ZIP verification",
    status: "public",
    url: CENSUS_TIGER_URL,
    note: "Use Census ZCTAs for geography previews and USPS ZIP/EDDM data for mailing execution.",
  },
  County: {
    badge: "ready",
    sourceName: "U.S. Census TIGER/Line county geometry",
    status: "ready",
    url: CENSUS_TIGER_URL,
    note: "Already used by the live map through us-atlas Census-derived county geometry.",
  },
  City: {
    badge: "OH GIS",
    sourceName: "Ohio Municipal Boundaries and Census Places",
    status: "official",
    url: OHIO_MUNICIPAL_BOUNDARIES_URL,
    note: "Ohio municipal polygons are available through the State of Ohio FeatureServer; Census Places cover national fallback.",
  },
  Township: {
    badge: "OH GIS",
    sourceName: "Ohio Township Boundaries and Census County Subdivisions",
    status: "official",
    url: OHIO_TOWNSHIP_BOUNDARIES_URL,
    note: "Ohio township polygons are available through State of Ohio GIS; Census county subdivisions provide national fallback.",
  },
  Village: {
    badge: "OH GIS",
    sourceName: "Ohio Municipal Boundaries and Census Places",
    status: "official",
    url: OHIO_MUNICIPAL_BOUNDARIES_URL,
    note: "Villages are represented in municipal/place boundary sources and can be filtered by municipality type after import.",
  },
  Precinct: {
    badge: "BOE",
    sourceName: "County board of elections precinct GIS files",
    status: "local",
    url: FRANKLIN_BOE_GIS_URL,
    note: "Precinct geometry is county-by-county. Franklin County provides a model import source; each county needs source lineage.",
  },
  Ward: {
    badge: "local",
    sourceName: "County and municipal board of elections ward maps",
    status: "local",
    url: FRANKLIN_BOE_GIS_URL,
    note: "Ward boundaries vary by city and county board of elections publication practices.",
  },
  "Congressional District": {
    badge: "ready",
    sourceName: "Ohio Secretary of State 2026-2032 congressional district SHAPE files",
    status: "ready",
    url: OHIO_SOS_DISTRICT_MAPS_URL,
    note: "Ohio, Illinois, and Tennessee congressional polygons are loaded in District mode from official or state GIS sources.",
  },
  "State Senate District": {
    badge: "ready",
    sourceName: "Ohio Secretary of State Ohio Senate Districts 2024-2032 SHAPE files",
    status: "ready",
    url: OHIO_SOS_DISTRICT_MAPS_URL,
    note: "Official Ohio Senate district polygons are loaded from the Ohio district FeatureServer.",
  },
  "State House District": {
    badge: "ready",
    sourceName: "Ohio Secretary of State Ohio House Districts 2024-2032 SHAPE files",
    status: "ready",
    url: OHIO_SOS_DISTRICT_MAPS_URL,
    note: "Official Ohio House district polygons are loaded from the Ohio district FeatureServer.",
  },
  "School Board District": {
    badge: "OH GIS",
    sourceName: "Ohio School District Boundaries 2025 FeatureServer",
    status: "official",
    url: OHIO_SCHOOL_DISTRICTS_URL,
    note: "Local school district polygons are available from Ohio GIS; State Board of Education district PDF remains a separate SOS source.",
  },
  "Judicial District": {
    badge: "SOS",
    sourceName: "Ohio Secretary of State Court of Appeals Districts map",
    status: "official",
    url: OHIO_SOS_DISTRICT_MAPS_URL,
    note: "Ohio Court of Appeals districts are published as an official PDF map; production polygons require conversion or county-based modeling.",
  },
  "Municipal District": {
    badge: "OH GIS",
    sourceName: "Ohio Municipal Boundaries FeatureServer",
    status: "official",
    url: OHIO_MUNICIPAL_BOUNDARIES_URL,
    note: "Municipal polygons are queryable as GeoJSON/PBF from State of Ohio GIS.",
  },
  "Census Tract": {
    badge: "Census",
    sourceName: "U.S. Census TIGERweb Tracts and Blocks service",
    status: "public",
    url: CENSUS_TRACTS_BLOCKS_URL,
    note: "Census tract polygons are available from TIGER/Line and TIGERweb.",
  },
  "Census Block Group": {
    badge: "Census",
    sourceName: "U.S. Census TIGER/Line Block Groups",
    status: "public",
    url: CENSUS_TIGER_URL,
    note: "Block group polygons are available from TIGER/Line state-based files and TIGERweb.",
  },
  "Neighborhood/Subdivision": {
    badge: "vendor",
    sourceName: "Property/parcel vendors or local GIS subdivision layers",
    status: "vendor",
    note: "No uniform public national source; use Regrid/ATTOM/local GIS with licensing review.",
  },
  "Custom Draw Polygon": {
    badge: "internal",
    sourceName: "HomeReach user-drawn polygon layer",
    status: "internal",
    note: "Store drawn geometry with campaign map plans and use server-side overlap validation before proposal.",
  },
  "Radius Targeting": {
    badge: "internal",
    sourceName: "HomeReach radius geometry generated from user input",
    status: "internal",
    note: "Can be generated internally after geocoder validation; route counts still need USPS verification.",
  },
  "Street-Level Selection": {
    badge: "vendor",
    sourceName: "CASS/DPV address validation plus campaign-provided lists",
    status: "vendor",
    note: "Requires address validation vendor and PII-safe workflow before production use.",
  },
  "Party Registration": {
    badge: "review",
    sourceName: "Public voter-file/BOE sources where lawful",
    status: "local",
    note: "Use only legally available aggregate or campaign-provided data; Ohio does not support individual persuasion scoring.",
  },
  "Primary Voting History": {
    badge: "BOE",
    sourceName: "County BOE/SOS aggregate election history",
    status: "local",
    url: OHIO_SOS_DISTRICT_MAPS_URL,
    note: "Use aggregate geography summaries only; never infer individual voter behavior.",
  },
  "General Election Voting History": {
    badge: "SOS",
    sourceName: "Ohio Secretary of State election results and county BOE precinct returns",
    status: "public",
    url: "https://www.ohiosos.gov/elections/election-results-and-data/",
    note: "Use certified aggregate results by geography where available.",
  },
  "Absentee Voting History": {
    badge: "BOE",
    sourceName: "County BOE/SOS aggregate absentee reports",
    status: "local",
    note: "County-specific availability; aggregate only.",
  },
  "Early Voting History": {
    badge: "BOE",
    sourceName: "County BOE/SOS aggregate early-vote reports",
    status: "local",
    note: "County-specific availability; aggregate only.",
  },
  "High Turnout Areas": {
    badge: "calc",
    sourceName: "HomeReach aggregate turnout calculation",
    status: "internal",
    note: "Derived from precinct/county aggregate results after source import.",
  },
  "Low Turnout Areas": {
    badge: "calc",
    sourceName: "HomeReach aggregate turnout calculation",
    status: "internal",
    note: "Derived from precinct/county aggregate results after source import.",
  },
  "Newly Registered Voters": {
    badge: "BOE",
    sourceName: "County BOE voter registration reporting where lawful",
    status: "local",
    note: "Must remain compliant with state/county use terms and campaign-provided consent limits.",
  },
  "Unaffiliated / Independent Voters": {
    badge: "review",
    sourceName: "State/county voter-file definitions where lawful",
    status: "local",
    note: "Definitions vary by state. Display aggregate geography only after compliance review.",
  },
  "Turnout Percentage by Area": {
    badge: "calc",
    sourceName: "Aggregate election result calculation",
    status: "internal",
    note: "Calculated from official aggregate turnout and registered-voter totals.",
  },
  "Historical Vote Margin": {
    badge: "ready",
    sourceName: "MIT/JHK 2024 presidential county aggregate layer",
    status: "ready",
    url: "https://projects.jhkforecasts.com/trends/",
    note: "County mode uses MIT/JHK 2024 county presidential returns with official FEC/SOS statewide lineage checks. Other geographies remain neutral until exact aggregate joins are imported.",
  },
  "Historical Republican Percentage": {
    badge: "SOS",
    sourceName: "Official aggregate election results",
    status: "public",
    url: "https://www.ohiosos.gov/elections/election-results-and-data/",
    note: "Calculated after official aggregate results import.",
  },
  "Historical Democrat Percentage": {
    badge: "SOS",
    sourceName: "Official aggregate election results",
    status: "public",
    url: "https://www.ohiosos.gov/elections/election-results-and-data/",
    note: "Calculated after official aggregate results import.",
  },
  "Third Party / Other Percentage": {
    badge: "SOS",
    sourceName: "Official aggregate election results",
    status: "public",
    url: "https://www.ohiosos.gov/elections/election-results-and-data/",
    note: "Calculated after official aggregate results import.",
  },
  "Undervote Areas": {
    badge: "SOS",
    sourceName: "Official aggregate election results",
    status: "public",
    note: "Requires contest-level aggregate result fields where available.",
  },
  "Overperforming Precincts": {
    badge: "calc",
    sourceName: "HomeReach aggregate result comparison",
    status: "internal",
    note: "Derived from imported aggregate precinct/district results; no individual prediction.",
  },
  "Underperforming Precincts": {
    badge: "calc",
    sourceName: "HomeReach aggregate result comparison",
    status: "internal",
    note: "Derived from imported aggregate precinct/district results; no individual prediction.",
  },
  "Vote Growth Trend": {
    badge: "calc",
    sourceName: "Multi-cycle aggregate election history",
    status: "internal",
    note: "Requires normalized official historical results across comparable geography.",
  },
  "Population Growth Trend": {
    badge: "ACS",
    sourceName: "U.S. Census ACS and Population Estimates",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Calculated from Census geography plus ACS/population estimate tables.",
  },
  "Household Income": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Join ACS aggregate tables to tract/block group geography.",
  },
  "Median Home Value": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Age Range": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Homeownership Percentage": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Renters Percentage": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Household Size": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Education Level": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Veteran Households": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Seniors 65+": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Families with Children": {
    badge: "ACS",
    sourceName: "U.S. Census American Community Survey",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography only.",
  },
  "Population Density": {
    badge: "ACS",
    sourceName: "U.S. Census ACS and TIGER/Line land area",
    status: "public",
    url: CENSUS_TIGER_URL,
    note: "Calculated from aggregate population and area.",
  },
  "New Movers": {
    badge: "vendor",
    sourceName: "Licensed mover/property data vendor",
    status: "vendor",
    note: "Requires licensed vendor data and campaign-use review.",
  },
  "Length of Residence": {
    badge: "vendor",
    sourceName: "Licensed property/consumer data vendor",
    status: "vendor",
    note: "Requires licensed vendor data and campaign-use review.",
  },
  "Rural / Suburban / Urban": {
    badge: "Census",
    sourceName: "Census Urban Areas and ACS geography",
    status: "public",
    url: CENSUS_TIGER_REST_URL,
    note: "Aggregate geography classification only.",
  },
  "Carrier Route Overlay": {
    badge: "USPS",
    sourceName: "USPS EDDM route tool or licensed carrier-route polygons",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "Current map route cells are demo. Production needs USPS verification or licensed polygon import.",
  },
  "EDDM Route Overlay": {
    badge: "USPS",
    sourceName: "USPS EDDM Online Tool",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "Use USPS EDDM for route planning verification before proposal/checkout.",
  },
  "ZIP+4": {
    badge: "vendor",
    sourceName: "USPS ZIP+4/carrier-route licensed data",
    status: "vendor",
    note: "Requires licensed USPS-derived dataset or approved mail vendor.",
  },
  "USPS Delivery Zones": {
    badge: "USPS",
    sourceName: "USPS EDDM and postal facility data",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "Use USPS source for execution verification.",
  },
  "USPS Walk Sequence": {
    badge: "vendor",
    sourceName: "USPS/vendor walk sequence files",
    status: "vendor",
    note: "Not public as a reusable dashboard layer; source through approved mail operations vendor.",
  },
  "Saturation Route": {
    badge: "USPS",
    sourceName: "USPS EDDM saturation eligibility",
    status: "usps",
    url: USPS_EDDM_BUSINESS_URL,
    note: "Verify eligibility and counts in USPS EDDM before production.",
  },
  "Residential Delivery Points": {
    badge: "USPS",
    sourceName: "USPS EDDM route counts",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "Verify live USPS route counts before pricing.",
  },
  "Business Delivery Points": {
    badge: "USPS",
    sourceName: "USPS EDDM route counts",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "Verify live USPS route counts before pricing.",
  },
  "PO Box Exclusions": {
    badge: "USPS",
    sourceName: "USPS route/address validation workflow",
    status: "usps",
    note: "Requires live USPS/vendor list processing for final mail file.",
  },
  "Vacant Address Exclusions": {
    badge: "CASS",
    sourceName: "CASS/DPV address validation vendor",
    status: "vendor",
    note: "Requires CASS/DPV or mail-house validation before production.",
  },
  "Non-Deliverable Address Exclusions": {
    badge: "CASS",
    sourceName: "CASS/DPV address validation vendor",
    status: "vendor",
    note: "Requires CASS/DPV or mail-house validation before production.",
  },
  "Deliverable Address Count": {
    badge: "USPS",
    sourceName: "USPS EDDM route counts",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "Current displayed values are demo until USPS counts are imported or verified.",
  },
  "Household Count": {
    badge: "USPS",
    sourceName: "USPS EDDM residential counts plus Census/ACS context",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "Use USPS for delivery counts and Census/ACS for geography context.",
  },
  "Estimated Postage": {
    badge: "ready",
    sourceName: "HomeReach pricing model plus USPS EDDM rates",
    status: "ready",
    url: USPS_EDDM_BUSINESS_URL,
    note: "Pricing uses HomeReach guardrails and should be verified against current USPS rates before checkout.",
  },
  "Estimated Print Cost": {
    badge: "ready",
    sourceName: "HomeReach print cost model",
    status: "ready",
    note: "Internal estimate; vendor quotes can override before proposal.",
  },
  "Estimated Total Cost": {
    badge: "ready",
    sourceName: "HomeReach political pricing model",
    status: "ready",
    note: "Combines print, postage, and operating margin guardrails.",
  },
  "Estimated Delivery Window": {
    badge: "USPS",
    sourceName: "USPS/mail-house delivery estimates",
    status: "usps",
    note: "Confirm with the selected mail-entry workflow.",
  },
  "Drop Date": {
    badge: "internal",
    sourceName: "HomeReach production calendar",
    status: "internal",
    note: "Internal operational date with mail-house/USPS confirmation.",
  },
  "Mail Frequency": {
    badge: "internal",
    sourceName: "HomeReach campaign plan",
    status: "internal",
    note: "Generated from selected strategy and drop count.",
  },
  "Number of Drops": {
    badge: "internal",
    sourceName: "HomeReach campaign plan",
    status: "internal",
    note: "Generated from selected strategy and drop count.",
  },
  "Total Pieces Required": {
    badge: "ready",
    sourceName: "HomeReach selected-route calculation",
    status: "ready",
    note: "Calculated from route counts and drop count; production counts need USPS verification.",
  },
  "Bundle Count": {
    badge: "USPS",
    sourceName: "USPS/mail-house mail preparation workflow",
    status: "usps",
    note: "Requires final route and piece-count verification.",
  },
  "Tray/Sack Estimate": {
    badge: "USPS",
    sourceName: "USPS BMEU mailing container requirements",
    status: "usps",
    url: USPS_EDDM_URL,
    note: "USPS EDDM route workflow includes container requirements.",
  },
  "BMEU Location": {
    badge: "USPS",
    sourceName: "USPS BMEU/Business Mail Entry lookup",
    status: "usps",
    note: "Source from USPS business mail entry resources.",
  },
  "SCF Region": {
    badge: "USPS",
    sourceName: "USPS postal logistics data",
    status: "usps",
    note: "Use mail-house or USPS-presort data for production.",
  },
  "NDC Region": {
    badge: "USPS",
    sourceName: "USPS postal logistics data",
    status: "usps",
    note: "Use mail-house or USPS-presort data for production.",
  },
  "Mail Entry Point": {
    badge: "USPS",
    sourceName: "USPS/mail-house entry plan",
    status: "usps",
    note: "Confirm based on final permit and route plan.",
  },
  "Destination Facility": {
    badge: "USPS",
    sourceName: "USPS/mail-house postal logistics",
    status: "usps",
    note: "Confirm based on final permit and route plan.",
  },
  "Estimated In-Home Window": {
    badge: "USPS",
    sourceName: "USPS/mail-house delivery estimates",
    status: "usps",
    note: "Confirm with the selected mail-entry workflow.",
  },
  "Postal Delivery Speed": {
    badge: "USPS",
    sourceName: "USPS/mail-house delivery estimates",
    status: "usps",
    note: "Confirm with the selected mail-entry workflow.",
  },
  "Route Efficiency": {
    badge: "calc",
    sourceName: "HomeReach route-density calculation",
    status: "internal",
    note: "Derived from route geometry and delivery counts after USPS/source import.",
  },
  "Presort Savings": {
    badge: "vendor",
    sourceName: "Mail-house presort quote",
    status: "vendor",
    note: "Requires fulfillment vendor or USPS/BMEU confirmation.",
  },
  "IMb Tracking Availability": {
    badge: "vendor",
    sourceName: "Mail-house Intelligent Mail barcode workflow",
    status: "vendor",
    note: "Depends on production vendor and mail class.",
  },
  "Delivery Confirmation Status": {
    badge: "vendor",
    sourceName: "Mail-house/USPS tracking feed",
    status: "vendor",
    note: "Requires fulfillment integration.",
  },
  "Route Density": {
    badge: "calc",
    sourceName: "HomeReach route-density calculation",
    status: "internal",
    note: "Derived from route geometry and delivery counts after USPS/source import.",
  },
  "Route Efficiency Score": {
    badge: "calc",
    sourceName: "HomeReach route efficiency model",
    status: "internal",
    note: "Derived from route density, overlap, and campaign constraints.",
  },
  "Duplicate Coverage Alert": {
    badge: "internal",
    sourceName: "HomeReach selected-route overlap detector",
    status: "internal",
    note: "Operational check once source geometries are imported.",
  },
  "Overlap Warning": {
    badge: "internal",
    sourceName: "HomeReach geometry overlap detector",
    status: "internal",
    note: "Operational check once source geometries are imported.",
  },
  "Mail Collision Detection": {
    badge: "internal",
    sourceName: "HomeReach campaign calendar",
    status: "internal",
    note: "Compares selected routes and drop dates across active campaigns.",
  },
  "Drop Scheduling Conflict": {
    badge: "internal",
    sourceName: "HomeReach campaign calendar",
    status: "internal",
    note: "Compares selected routes and drop dates across active campaigns.",
  },
  "Print Deadline": {
    badge: "internal",
    sourceName: "HomeReach production calendar",
    status: "internal",
    note: "Calculated from drop date and vendor lead time.",
  },
  "Mail Prep Deadline": {
    badge: "internal",
    sourceName: "HomeReach production calendar",
    status: "internal",
    note: "Calculated from drop date and mail-prep workflow.",
  },
  "BMEU Appointment Deadline": {
    badge: "USPS",
    sourceName: "USPS/BMEU appointment workflow",
    status: "usps",
    note: "Confirm from USPS/BMEU process for the selected entry point.",
  },
};

const STATE_LAYER_SOURCE_META: Partial<Record<StateKey, Partial<Record<string, LayerSourceMeta>>>> = {
  illinois: {
    City: {
      badge: "IL GIS",
      sourceName: "Illinois DOT ILBoundaries towns plus Census Places",
      status: "official",
      url: ILLINOIS_TOWNS_URL,
      note: "Illinois town and municipal geography is available through the ILBoundaries ArcGIS service; Census Places remain the national fallback.",
    },
    Township: {
      badge: "IL GIS",
      sourceName: "Illinois DOT political township boundaries",
      status: "official",
      url: ILLINOIS_TOWNSHIP_URL,
      note: "Illinois township boundaries are available as an ILBoundaries layer.",
    },
    Village: {
      badge: "IL GIS",
      sourceName: "Illinois DOT ILBoundaries towns plus Census Places",
      status: "official",
      url: ILLINOIS_TOWNS_URL,
      note: "Village and municipal place coverage should be filtered from town/place boundary sources before production use.",
    },
    Precinct: {
      badge: "local",
      sourceName: "Illinois county election authorities and Census voting districts",
      status: "local",
      url: CENSUS_TIGER_URL,
      note: "Precincts are county-administered and must be imported county-by-county or from current election authority exports.",
    },
    Ward: {
      badge: "local",
      sourceName: "Municipal and county election authority ward maps",
      status: "local",
      url: ILLINOIS_TOWNS_URL,
      note: "Ward boundaries vary by municipality and must retain local source lineage.",
    },
    "Congressional District": {
      badge: "IL GIS",
      sourceName: "Illinois DOT ILBoundaries Congressional layer",
      status: "ready",
      url: ILLINOIS_CONGRESSIONAL_DISTRICTS_URL,
      note: "Official Illinois congressional polygons are loaded in District mode.",
    },
    "State Senate District": {
      badge: "IL GIS",
      sourceName: "Illinois DOT ILBoundaries Senate layer",
      status: "ready",
      url: ILLINOIS_SENATE_DISTRICTS_URL,
      note: "Official Illinois State Senate polygons are loaded when this layer is active.",
    },
    "State House District": {
      badge: "IL GIS",
      sourceName: "Illinois DOT ILBoundaries House layer",
      status: "ready",
      url: ILLINOIS_HOUSE_DISTRICTS_URL,
      note: "Official Illinois State House polygons are loaded when this layer is active.",
    },
    "School Board District": {
      badge: "Census",
      sourceName: "Census school district TIGER/Line files plus local education GIS",
      status: "public",
      url: CENSUS_TIGER_URL,
      note: "School district geography is available from Census TIGER/Line; local school-board election boundaries may differ.",
    },
    "Judicial District": {
      badge: "local",
      sourceName: "Illinois judicial circuit/court boundary references",
      status: "local",
      url: "https://www.illinoiscourts.gov/courts-directory/circuit-court/",
      note: "Judicial geography should be imported from court/circuit references and verified before candidate planning.",
    },
    "Municipal District": {
      badge: "IL GIS",
      sourceName: "Illinois DOT ILBoundaries towns and local ward sources",
      status: "official",
      url: ILLINOIS_TOWNS_URL,
      note: "Municipal boundaries are source-backed; council/ward districts still require local imports.",
    },
    "General Election Voting History": {
      badge: "SBE",
      sourceName: "Illinois State Board of Elections vote totals",
      status: "public",
      url: ILLINOIS_ELECTION_RESULTS_URL,
      note: "Use official aggregate election results and keep joins neutral until geography alignment is verified.",
    },
    "Historical Vote Margin": {
      badge: "SBE",
      sourceName: "Illinois State Board of Elections and MIT/JHK county aggregate history",
      status: "public",
      url: ILLINOIS_ELECTION_RESULTS_URL,
      note: "County aggregates can be imported; sub-county layers stay neutral until exact aggregate joins are loaded.",
    },
    "Historical Republican Percentage": {
      badge: "SBE",
      sourceName: "Illinois State Board of Elections vote totals",
      status: "public",
      url: ILLINOIS_ELECTION_RESULTS_URL,
      note: "Calculated from official aggregate results after source import.",
    },
    "Historical Democrat Percentage": {
      badge: "SBE",
      sourceName: "Illinois State Board of Elections vote totals",
      status: "public",
      url: ILLINOIS_ELECTION_RESULTS_URL,
      note: "Calculated from official aggregate results after source import.",
    },
  },
  tennessee: {
    City: {
      badge: "Census",
      sourceName: "Census Places plus Tennessee local GIS references",
      status: "public",
      url: CENSUS_PLACES_URL,
      note: "Tennessee city markers use verified coordinates and Census place fallback until municipal polygons are imported.",
    },
    Township: {
      badge: "n/a",
      sourceName: "Census county subdivisions",
      status: "public",
      url: CENSUS_PLACES_URL,
      note: "Tennessee does not have a statewide civil-township layer like Illinois or Ohio; use county subdivision and municipality context.",
    },
    Village: {
      badge: "Census",
      sourceName: "Census Places and local municipality GIS",
      status: "public",
      url: CENSUS_PLACES_URL,
      note: "Use Census place boundaries and local municipal source checks for Tennessee city/town coverage.",
    },
    Precinct: {
      badge: "TN PA",
      sourceName: "Tennessee Comptroller county redistricting data and county election commissions",
      status: "local",
      url: TENNESSEE_COMPTROLLER_REDISTRICTING_URL,
      note: "The Comptroller provides county redistricting data/maps in PDF and KMZ formats; current precinct geometry remains county-by-county.",
    },
    Ward: {
      badge: "local",
      sourceName: "Tennessee municipal and county election sources",
      status: "local",
      url: TENNESSEE_COMPTROLLER_REDISTRICTING_URL,
      note: "Ward or council districts vary by city and require local source imports.",
    },
    "Congressional District": {
      badge: "TNMap",
      sourceName: "TNMap Tennessee Congressional Districts",
      status: "ready",
      url: TENNESSEE_CONGRESSIONAL_DISTRICTS_URL,
      note: "Official Tennessee congressional polygons are loaded in District mode.",
    },
    "State Senate District": {
      badge: "TNMap",
      sourceName: "TNMap Tennessee Senate Districts",
      status: "ready",
      url: TENNESSEE_SENATE_DISTRICTS_URL,
      note: "Official Tennessee State Senate polygons are loaded when this layer is active.",
    },
    "State House District": {
      badge: "TNMap",
      sourceName: "TNMap Tennessee House Districts",
      status: "ready",
      url: TENNESSEE_HOUSE_DISTRICTS_URL,
      note: "Official Tennessee State House polygons are loaded when this layer is active.",
    },
    "School Board District": {
      badge: "Census",
      sourceName: "Census school district TIGER/Line files plus county education GIS",
      status: "public",
      url: CENSUS_TIGER_URL,
      note: "School district geography is available from Census TIGER/Line; election-specific board seats need local verification.",
    },
    "Judicial District": {
      badge: "TN",
      sourceName: "Tennessee courts and state/local judicial district references",
      status: "local",
      url: "https://www.tncourts.gov/courts/circuit-criminal-chancery-courts/judicial-districts",
      note: "Judicial district boundaries require court-source validation before campaign planning.",
    },
    "Municipal District": {
      badge: "local",
      sourceName: "Tennessee municipal GIS and Comptroller redistricting references",
      status: "local",
      url: TENNESSEE_COMPTROLLER_REDISTRICTING_URL,
      note: "City council and municipal election districts are local-source imports, not a single statewide layer.",
    },
    "General Election Voting History": {
      badge: "SOS",
      sourceName: "Tennessee Secretary of State election results",
      status: "public",
      url: TENNESSEE_ELECTION_RESULTS_URL,
      note: "Use official aggregate election results and keep joins neutral until geography alignment is verified.",
    },
    "Historical Vote Margin": {
      badge: "SOS",
      sourceName: "Tennessee Secretary of State and MIT/JHK county aggregate history",
      status: "public",
      url: TENNESSEE_ELECTION_RESULTS_URL,
      note: "County aggregates can be imported; sub-county layers stay neutral until exact aggregate joins are loaded.",
    },
    "Historical Republican Percentage": {
      badge: "SOS",
      sourceName: "Tennessee Secretary of State election results",
      status: "public",
      url: TENNESSEE_ELECTION_RESULTS_URL,
      note: "Calculated from official aggregate results after source import.",
    },
    "Historical Democrat Percentage": {
      badge: "SOS",
      sourceName: "Tennessee Secretary of State election results",
      status: "public",
      url: TENNESSEE_ELECTION_RESULTS_URL,
      note: "Calculated from official aggregate results after source import.",
    },
  },
};

function getLayerSourceMeta(layer: string, stateKey: StateKey): LayerSourceMeta {
  return STATE_LAYER_SOURCE_META[stateKey]?.[layer] ?? LAYER_SOURCE_META[layer] ?? DEFAULT_LAYER_SOURCE;
}

function layerSourceTone(status: LayerSourceStatus) {
  if (status === "ready") return "border-emerald-300/25 bg-emerald-500/15 text-emerald-100";
  if (status === "official") return "border-blue-300/25 bg-blue-500/15 text-blue-100";
  if (status === "public") return "border-cyan-300/25 bg-cyan-500/15 text-cyan-100";
  if (status === "usps") return "border-indigo-300/25 bg-indigo-500/15 text-indigo-100";
  if (status === "internal") return "border-violet-300/25 bg-violet-500/15 text-violet-100";
  if (status === "vendor") return "border-amber-300/25 bg-amber-500/15 text-amber-100";
  if (status === "local") return "border-orange-300/25 bg-orange-500/15 text-orange-100";
  return "border-slate-300/20 bg-slate-500/15 text-slate-200";
}

interface CountyPresidentialResult2024 {
  county: string;
  rep: number;
  dem: number;
  repPct: number;
  demPct: number;
}

const PRESIDENTIAL_RESULT_SOURCE =
  "2024 U.S. President county aggregate from MIT Election Lab/JHK Forecasts county-results.csv, with statewide totals cross-checked against FEC 2024 official results and Ohio Secretary of State data portal lineage.";

const OHIO_2024_PRESIDENTIAL_BY_COUNTY_FIPS: Record<string, CountyPresidentialResult2024> = {
  "39001": { county: "Adams", rep: 10269, dem: 2098, repPct: 82.62, demPct: 16.88 },
  "39003": { county: "Allen", rep: 33201, dem: 12754, repPct: 71.6, demPct: 27.51 },
  "39005": { county: "Ashland", rep: 19863, dem: 6544, repPct: 74.5, demPct: 24.54 },
  "39007": { county: "Ashtabula", rep: 27656, dem: 15345, repPct: 63.76, demPct: 35.38 },
  "39009": { county: "Athens", rep: 11369, dem: 14134, repPct: 44.11, demPct: 54.83 },
  "39011": { county: "Auglaize", rep: 20988, dem: 4442, repPct: 81.89, demPct: 17.33 },
  "39013": { county: "Belmont", rep: 22758, dem: 8080, repPct: 73.33, demPct: 26.03 },
  "39015": { county: "Brown", rep: 17257, dem: 4069, repPct: 80.47, demPct: 18.98 },
  "39017": { county: "Butler", rep: 114831, dem: 66713, repPct: 62.68, demPct: 36.42 },
  "39019": { county: "Carroll", rep: 10634, dem: 3071, repPct: 76.95, demPct: 22.22 },
  "39021": { county: "Champaign", rep: 15334, dem: 4944, repPct: 74.89, demPct: 24.15 },
  "39023": { county: "Clark", rep: 40403, dem: 21847, repPct: 64.28, demPct: 34.76 },
  "39025": { county: "Clermont", rep: 76964, dem: 36130, repPct: 67.43, demPct: 31.65 },
  "39027": { county: "Clinton", rep: 15984, dem: 4633, repPct: 76.92, demPct: 22.3 },
  "39029": { county: "Columbiana", rep: 35607, dem: 12064, repPct: 74.1, demPct: 25.11 },
  "39031": { county: "Coshocton", rep: 12362, dem: 3835, repPct: 75.67, demPct: 23.47 },
  "39033": { county: "Crawford", rep: 15402, dem: 4683, repPct: 76.08, demPct: 23.13 },
  "39035": { county: "Cuyahoga", rep: 195164, dem: 376384, repPct: 33.85, demPct: 65.29 },
  "39037": { county: "Darke", rep: 22234, dem: 4583, repPct: 82.34, demPct: 16.97 },
  "39039": { county: "Defiance", rep: 13302, dem: 5667, repPct: 69.44, demPct: 29.58 },
  "39041": { county: "Delaware", rep: 70448, dem: 61657, repPct: 52.81, demPct: 46.22 },
  "39043": { county: "Erie", rep: 22493, dem: 16871, repPct: 56.59, demPct: 42.44 },
  "39045": { county: "Fairfield", rep: 51999, dem: 31695, repPct: 61.57, demPct: 37.53 },
  "39047": { county: "Fayette", rep: 9706, dem: 2773, repPct: 77.21, demPct: 22.06 },
  "39049": { county: "Franklin", rep: 210830, dem: 380518, repPct: 35.24, demPct: 63.61 },
  "39051": { county: "Fulton", rep: 15893, dem: 6374, repPct: 70.78, demPct: 28.39 },
  "39053": { county: "Gallia", rep: 10314, dem: 2592, repPct: 79.33, demPct: 19.94 },
  "39055": { county: "Geauga", rep: 33844, dem: 20604, repPct: 61.65, demPct: 37.53 },
  "39057": { county: "Greene", rep: 53399, dem: 35575, repPct: 59.31, demPct: 39.51 },
  "39059": { county: "Guernsey", rep: 13314, dem: 4154, repPct: 75.64, demPct: 23.6 },
  "39061": { county: "Hamilton", rep: 172365, dem: 233360, repPct: 42.03, demPct: 56.91 },
  "39063": { county: "Hancock", rep: 26052, dem: 11467, repPct: 68.66, demPct: 30.22 },
  "39065": { county: "Hardin", rep: 9911, dem: 2863, repPct: 76.87, demPct: 22.21 },
  "39067": { county: "Harrison", rep: 5484, dem: 1559, repPct: 77.13, demPct: 21.93 },
  "39069": { county: "Henry", rep: 10873, dem: 3905, repPct: 72.91, demPct: 26.19 },
  "39071": { county: "Highland", rep: 16269, dem: 3609, repPct: 81.4, demPct: 18.06 },
  "39073": { county: "Hocking", rep: 9679, dem: 3704, repPct: 71.75, demPct: 27.46 },
  "39075": { county: "Holmes", rep: 10384, dem: 1854, repPct: 84.18, demPct: 15.03 },
  "39077": { county: "Huron", rep: 19484, dem: 7496, repPct: 71.59, demPct: 27.54 },
  "39079": { county: "Jackson", rep: 11249, dem: 2953, repPct: 78.74, demPct: 20.67 },
  "39081": { county: "Jefferson", rep: 22317, dem: 8592, repPct: 71.38, demPct: 27.48 },
  "39083": { county: "Knox", rep: 23112, dem: 8698, repPct: 71.99, demPct: 27.09 },
  "39085": { county: "Lake", rep: 72924, dem: 54484, repPct: 56.72, demPct: 42.37 },
  "39087": { county: "Lawrence", rep: 20013, dem: 6514, repPct: 74.92, demPct: 24.39 },
  "39089": { county: "Licking", rep: 61359, dem: 32832, repPct: 64.55, demPct: 34.54 },
  "39091": { county: "Logan", rep: 18182, dem: 5027, repPct: 77.68, demPct: 21.48 },
  "39093": { county: "Lorain", rep: 83297, dem: 74207, repPct: 52.39, demPct: 46.67 },
  "39095": { county: "Lucas", rep: 82398, dem: 106320, repPct: 43.23, demPct: 55.78 },
  "39097": { county: "Madison", rep: 14737, dem: 5713, repPct: 71.3, demPct: 27.64 },
  "39099": { county: "Mahoning", rep: 61249, dem: 50636, repPct: 54.34, demPct: 44.93 },
  "39101": { county: "Marion", rep: 19219, dem: 7902, repPct: 70.25, demPct: 28.88 },
  "39103": { county: "Medina", rep: 66308, dem: 39771, repPct: 61.94, demPct: 37.15 },
  "39105": { county: "Meigs", rep: 8127, dem: 2202, repPct: 78.14, demPct: 21.17 },
  "39107": { county: "Mercer", rep: 19710, dem: 3865, repPct: 82.98, demPct: 16.27 },
  "39109": { county: "Miami", rep: 42677, dem: 15969, repPct: 72.1, demPct: 26.98 },
  "39111": { county: "Monroe", rep: 5396, dem: 1336, repPct: 79.4, demPct: 19.66 },
  "39113": { county: "Montgomery", rep: 125566, dem: 126767, repPct: 49.27, demPct: 49.74 },
  "39115": { county: "Morgan", rep: 5168, dem: 1560, repPct: 76.2, demPct: 23 },
  "39117": { county: "Morrow", rep: 14609, dem: 4100, repPct: 77.47, demPct: 21.74 },
  "39119": { county: "Muskingum", rep: 28147, dem: 10874, repPct: 71.56, demPct: 27.65 },
  "39121": { county: "Noble", rep: 5050, dem: 1069, repPct: 81.97, demPct: 17.35 },
  "39123": { county: "Ottawa", rep: 14872, dem: 8866, repPct: 62.07, demPct: 37 },
  "39125": { county: "Paulding", rep: 7203, dem: 1987, repPct: 77.64, demPct: 21.42 },
  "39127": { county: "Perry", rep: 13062, dem: 3800, repPct: 76.87, demPct: 22.36 },
  "39129": { county: "Pickaway", rep: 21607, dem: 7397, repPct: 73.79, demPct: 25.26 },
  "39131": { county: "Pike", rep: 9352, dem: 2793, repPct: 76.54, demPct: 22.86 },
  "39133": { county: "Portage", rep: 47681, dem: 34759, repPct: 57.29, demPct: 41.76 },
  "39135": { county: "Preble", rep: 17146, dem: 4343, repPct: 79.17, demPct: 20.05 },
  "39137": { county: "Putnam", rep: 16576, dem: 2996, repPct: 83.9, demPct: 15.16 },
  "39139": { county: "Richland", rep: 41298, dem: 16591, repPct: 70.76, demPct: 28.43 },
  "39141": { county: "Ross", rep: 22801, dem: 9846, repPct: 69.24, demPct: 29.9 },
  "39143": { county: "Sandusky", rep: 19311, dem: 10139, repPct: 64.99, demPct: 34.12 },
  "39145": { county: "Scioto", rep: 22978, dem: 8021, repPct: 73.69, demPct: 25.72 },
  "39147": { county: "Seneca", rep: 17241, dem: 7765, repPct: 68.25, demPct: 30.74 },
  "39149": { county: "Shelby", rep: 20740, dem: 4350, repPct: 82.02, demPct: 17.2 },
  "39151": { county: "Stark", rep: 111478, dem: 71090, repPct: 60.52, demPct: 38.6 },
  "39153": { county: "Summit", rep: 125910, dem: 145005, repPct: 46.02, demPct: 53 },
  "39155": { county: "Trumbull", rep: 55983, dem: 39758, repPct: 57.99, demPct: 41.19 },
  "39157": { county: "Tuscarawas", rep: 30652, dem: 12032, repPct: 71.25, demPct: 27.97 },
  "39159": { county: "Union", rep: 23982, dem: 12934, repPct: 64.29, demPct: 34.67 },
  "39161": { county: "Van Wert", rep: 11616, dem: 3000, repPct: 78.86, demPct: 20.37 },
  "39163": { county: "Vinton", rep: 4531, dem: 1169, repPct: 78.96, demPct: 20.37 },
  "39165": { county: "Warren", rep: 91132, dem: 47128, repPct: 65.27, demPct: 33.75 },
  "39167": { county: "Washington", rep: 22161, dem: 8600, repPct: 71.49, demPct: 27.74 },
  "39169": { county: "Wayne", rep: 36764, dem: 15898, repPct: 69.17, demPct: 29.91 },
  "39171": { county: "Williams", rep: 13461, dem: 4644, repPct: 73.66, demPct: 25.41 },
  "39173": { county: "Wood", rep: 36877, dem: 30016, repPct: 54.56, demPct: 44.41 },
  "39175": { county: "Wyandot", rep: 8564, dem: 2731, repPct: 75.19, demPct: 23.98 },
};

const MODE_CONFIG: Record<PoliticalMode, { label: string; icon: typeof MapIcon; source: DataLabel }> = {
  county: { label: "County", icon: MapIcon, source: "Public Aggregate" },
  zipcode: { label: "ZIP", icon: Layers3, source: "Estimated" },
  city: { label: "City", icon: Building2, source: "Estimated" },
  district: { label: "District", icon: Landmark, source: "Estimated" },
};

const countiesTopology = countiesTopologyRaw as unknown as Topology;
const statesTopology = statesTopologyRaw as unknown as Topology;
type DistrictFeatureProperties = { district?: string; id?: number; label?: string };
interface StatePoliticalDistrictData {
  stateKey: string;
  sourceName: string;
  sourceUrl: string;
  sourceCycle: string;
  layers: Partial<Record<
    OfficialDistrictLayerKey,
    {
      label: string;
      sourceUrl: string;
      featureCount: number;
      featureCollection: FeatureCollection<Geometry, DistrictFeatureProperties>;
    }
  >>;
}

const ohioPoliticalDistricts = ohioPoliticalDistrictsRaw as StatePoliticalDistrictData;
const illinoisPoliticalDistricts = illinoisPoliticalDistrictsRaw as StatePoliticalDistrictData;
const tennesseePoliticalDistricts = tennesseePoliticalDistrictsRaw as StatePoliticalDistrictData;
const OFFICIAL_DISTRICT_DATA_BY_STATE: Partial<Record<StateKey, StatePoliticalDistrictData>> = {
  ohio: ohioPoliticalDistricts,
  illinois: illinoisPoliticalDistricts,
  tennessee: tennesseePoliticalDistricts,
};
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

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function countyHouseholds(id: string) {
  return 9500 + (hashText(id) % 54000);
}

function neutralPartisanFields(source: string): Pick<
  PoliticalUnit,
  "lean" | "intensity" | "partisanDataReady" | "source"
> {
  return {
    lean: "mixed",
    intensity: "light",
    partisanDataReady: false,
    source,
  };
}

function intensityForMargin(absMarginPct: number): PoliticalUnit["intensity"] {
  if (absMarginPct >= 25) return "strong";
  if (absMarginPct >= 10) return "medium";
  return "light";
}

function countyElectionFields(countyId: string): Pick<
  PoliticalUnit,
  "lean" | "intensity" | "partisanDataReady" | "source" | "electionMarginPct" | "republicanPct" | "democraticPct"
> {
  const result = OHIO_2024_PRESIDENTIAL_BY_COUNTY_FIPS[countyId];
  if (!result) {
    return neutralPartisanFields(
      "No validated partisan result is loaded for this geography. It is intentionally neutral until a source-backed aggregate is imported.",
    );
  }

  const marginPct = Number((result.repPct - result.demPct).toFixed(2));
  const absMarginPct = Math.abs(marginPct);

  return {
    lean: absMarginPct < 5 ? "mixed" : marginPct > 0 ? "republican" : "democrat",
    intensity: intensityForMargin(absMarginPct),
    partisanDataReady: true,
    electionMarginPct: marginPct,
    republicanPct: result.repPct,
    democraticPct: result.demPct,
    source: `${PRESIDENTIAL_RESULT_SOURCE} ${result.county} County: R ${result.repPct.toFixed(2)}%, D ${result.demPct.toFixed(2)}%, margin ${marginPct > 0 ? "R+" : "D+"}${Math.abs(marginPct).toFixed(2)}.`,
  };
}

function slugifyMapLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cityUnitId(state: (typeof STATES)[StateKey], market: string) {
  return `${state.shortLabel}-city-${slugifyMapLabel(market)}`;
}

const CITY_MARKET_BY_STATE_AND_COUNTY: Partial<Record<StateKey, Record<string, string>>> = {
  ohio: {
    Hamilton: "Cincinnati Metro",
    Butler: "Cincinnati Metro",
    Clermont: "Cincinnati Metro",
    Warren: "Cincinnati Metro",
    Brown: "Cincinnati Metro",
    Montgomery: "Dayton Metro",
    Greene: "Dayton Metro",
    Miami: "Dayton Metro",
    Clark: "Dayton Metro",
    Preble: "Dayton Metro",
    Darke: "Dayton Metro",
    Champaign: "Dayton Metro",
    Franklin: "Columbus Metro",
    Delaware: "Columbus Metro",
    Licking: "Columbus Metro",
    Fairfield: "Columbus Metro",
    Pickaway: "Columbus Metro",
    Madison: "Columbus Metro",
    Union: "Columbus Metro",
    Cuyahoga: "Cleveland Metro",
    Lake: "Cleveland Metro",
    Geauga: "Cleveland Metro",
    Lorain: "Cleveland Metro",
    Medina: "Cleveland Metro",
    Summit: "Akron Corridor",
    Portage: "Akron Corridor",
    Stark: "Akron Corridor",
    Wayne: "Akron Corridor",
    Lucas: "Toledo Metro",
    Wood: "Toledo Metro",
    Ottawa: "Toledo Metro",
    Fulton: "Toledo Metro",
    Henry: "Toledo Metro",
    Defiance: "Northwest Ohio",
    Williams: "Northwest Ohio",
    Paulding: "Northwest Ohio",
    Mahoning: "Youngstown Valley",
    Trumbull: "Youngstown Valley",
    Columbiana: "Youngstown Valley",
    Richland: "Mansfield-Marion",
    Crawford: "Mansfield-Marion",
    Marion: "Mansfield-Marion",
    Morrow: "Mansfield-Marion",
    Knox: "Mansfield-Marion",
    Ashland: "Mansfield-Marion",
    Allen: "Lima-Findlay Corridor",
    Hancock: "Lima-Findlay Corridor",
    Putnam: "Lima-Findlay Corridor",
    Auglaize: "Lima-Findlay Corridor",
    Hardin: "Lima-Findlay Corridor",
    "Van Wert": "Lima-Findlay Corridor",
    Mercer: "Lima-Findlay Corridor",
    Shelby: "Lima-Findlay Corridor",
    Wyandot: "Lima-Findlay Corridor",
    Erie: "Sandusky-Erie Coast",
    Huron: "Sandusky-Erie Coast",
    Sandusky: "Sandusky-Erie Coast",
    Seneca: "Sandusky-Erie Coast",
    Muskingum: "Zanesville-Newark Corridor",
    Perry: "Zanesville-Newark Corridor",
    Coshocton: "Zanesville-Newark Corridor",
    Guernsey: "Zanesville-Newark Corridor",
    Morgan: "Zanesville-Newark Corridor",
    Noble: "Zanesville-Newark Corridor",
    Tuscarawas: "Zanesville-Newark Corridor",
    Athens: "Southeast Ohio",
    Washington: "Southeast Ohio",
    Meigs: "Southeast Ohio",
    Vinton: "Southeast Ohio",
    Gallia: "Southeast Ohio",
    Hocking: "Southeast Ohio",
    Lawrence: "Southeast Ohio",
    Ross: "Southern Ohio",
    Pike: "Southern Ohio",
    Scioto: "Southern Ohio",
    Jackson: "Southern Ohio",
    Adams: "Southern Ohio",
    Highland: "Southern Ohio",
    Fayette: "Southern Ohio",
    Clinton: "Southern Ohio",
    Jefferson: "Ohio Valley",
    Belmont: "Ohio Valley",
    Harrison: "Ohio Valley",
    Monroe: "Ohio Valley",
    Carroll: "Ohio Valley",
    Ashtabula: "Ashtabula-Lake Erie",
  },
  illinois: {
    Cook: "Chicago Metro",
    DuPage: "Chicago Metro",
    Lake: "Chicago Metro",
    Kane: "Chicago Metro",
    McHenry: "Chicago Metro",
    Will: "Aurora-Joliet Corridor",
    Kendall: "Aurora-Joliet Corridor",
    Grundy: "Aurora-Joliet Corridor",
    Winnebago: "Rockford Region",
    Boone: "Rockford Region",
    Ogle: "Northwest Illinois",
    Lee: "Northwest Illinois",
    DeKalb: "Northwest Illinois",
    Stephenson: "Northwest Illinois",
    "Jo Daviess": "Northwest Illinois",
    Carroll: "Northwest Illinois",
    Whiteside: "Northwest Illinois",
    Peoria: "Peoria Region",
    Tazewell: "Peoria Region",
    Woodford: "Peoria Region",
    Fulton: "Peoria Region",
    McLean: "Bloomington-Normal",
    Livingston: "Bloomington-Normal",
    Sangamon: "Springfield Region",
    Menard: "Springfield Region",
    Morgan: "Springfield Region",
    Macoupin: "Springfield Region",
    Christian: "Springfield Region",
    Champaign: "Champaign-Urbana",
    Piatt: "Champaign-Urbana",
    Vermilion: "Champaign-Urbana",
    Douglas: "Champaign-Urbana",
    Macon: "Champaign-Urbana",
    "Rock Island": "Quad Cities",
    Henry: "Quad Cities",
    Mercer: "Quad Cities",
    Adams: "Quincy-Western Illinois",
    Pike: "Quincy-Western Illinois",
    Brown: "Quincy-Western Illinois",
    Hancock: "Quincy-Western Illinois",
    Kankakee: "Kankakee-Iroquois",
    Iroquois: "Kankakee-Iroquois",
    Madison: "Metro East",
    "St. Clair": "Metro East",
    Monroe: "Metro East",
    Clinton: "Metro East",
    Jersey: "Metro East",
    Bond: "Metro East",
    Jackson: "Southern Illinois",
    Williamson: "Southern Illinois",
    Franklin: "Southern Illinois",
    Union: "Southern Illinois",
    Johnson: "Southern Illinois",
    Saline: "Southern Illinois",
    Alexander: "Southern Illinois",
    Pulaski: "Southern Illinois",
    Massac: "Southern Illinois",
    Pope: "Southern Illinois",
    Hardin: "Southern Illinois",
    Gallatin: "Southern Illinois",
    Randolph: "Southern Illinois",
  },
  tennessee: {
    Davidson: "Nashville Metro",
    Williamson: "Murfreesboro-Franklin Corridor",
    Rutherford: "Murfreesboro-Franklin Corridor",
    Wilson: "Nashville Metro",
    Sumner: "Nashville Metro",
    Robertson: "Nashville Metro",
    Cheatham: "Nashville Metro",
    Dickson: "Nashville Metro",
    Maury: "Columbia-Shelbyville Corridor",
    Marshall: "Columbia-Shelbyville Corridor",
    Bedford: "Columbia-Shelbyville Corridor",
    Lincoln: "Columbia-Shelbyville Corridor",
    Shelby: "Memphis Metro",
    Fayette: "Memphis Metro",
    Tipton: "Memphis Metro",
    Lauderdale: "Memphis Metro",
    Knox: "Knoxville Metro",
    Anderson: "Knoxville Metro",
    Blount: "Knoxville Metro",
    Loudon: "Knoxville Metro",
    Sevier: "Knoxville Metro",
    Roane: "Knoxville Metro",
    Jefferson: "Knoxville Metro",
    Hamilton: "Chattanooga Metro",
    Bradley: "Cleveland-Athens Corridor",
    McMinn: "Cleveland-Athens Corridor",
    Meigs: "Cleveland-Athens Corridor",
    Marion: "Chattanooga Metro",
    Sequatchie: "Chattanooga Metro",
    Sullivan: "Tri-Cities",
    Washington: "Tri-Cities",
    Carter: "Tri-Cities",
    Hawkins: "Tri-Cities",
    Greene: "Tri-Cities",
    Unicoi: "Tri-Cities",
    Johnson: "Tri-Cities",
    Montgomery: "Clarksville Region",
    Stewart: "Clarksville Region",
    Houston: "Clarksville Region",
    Madison: "Jackson Region",
    Gibson: "Jackson Region",
    Haywood: "Jackson Region",
    Crockett: "Jackson Region",
    Chester: "Jackson Region",
    Henderson: "Jackson Region",
    Putnam: "Cookeville-Cumberland Plateau",
    Cumberland: "Cookeville-Cumberland Plateau",
    White: "Cookeville-Cumberland Plateau",
    DeKalb: "Cookeville-Cumberland Plateau",
    Warren: "Cookeville-Cumberland Plateau",
  },
};

const CITY_MARKERS_BY_STATE: Record<StateKey, CityMarkerSource[]> = {
  ohio: [
    { label: "Columbus", market: "Columbus Metro", coordinates: [-82.9988, 39.9612], priority: 1 },
    { label: "Cleveland", market: "Cleveland Metro", coordinates: [-81.6944, 41.4993], priority: 1 },
    { label: "Cincinnati", market: "Cincinnati Metro", coordinates: [-84.512, 39.1031], priority: 1 },
    { label: "Toledo", market: "Toledo Metro", coordinates: [-83.5552, 41.6528], priority: 1 },
    { label: "Akron", market: "Akron Corridor", coordinates: [-81.519, 41.0814], priority: 1 },
    { label: "Dayton", market: "Dayton Metro", coordinates: [-84.1916, 39.7589], priority: 1 },
    { label: "Youngstown", market: "Youngstown Valley", coordinates: [-80.6495, 41.0998], priority: 1 },
    { label: "Canton", market: "Akron Corridor", coordinates: [-81.3784, 40.7989], priority: 2 },
    { label: "Lorain", market: "Cleveland Metro", coordinates: [-82.1824, 41.4528], priority: 2 },
    { label: "Elyria", market: "Cleveland Metro", coordinates: [-82.1076, 41.3684], priority: 2 },
    { label: "Parma", market: "Cleveland Metro", coordinates: [-81.7229, 41.4048], priority: 2 },
    { label: "Lakewood", market: "Cleveland Metro", coordinates: [-81.7982, 41.4819], priority: 3 },
    { label: "Mentor", market: "Cleveland Metro", coordinates: [-81.3396, 41.6662], priority: 2 },
    { label: "Hamilton", market: "Cincinnati Metro", coordinates: [-84.5613, 39.3995], priority: 2 },
    { label: "Middletown", market: "Cincinnati Metro", coordinates: [-84.3983, 39.5151], priority: 2 },
    { label: "Springfield", market: "Dayton Metro", coordinates: [-83.8088, 39.9242], priority: 2 },
    { label: "Kettering", market: "Dayton Metro", coordinates: [-84.1688, 39.6895], priority: 3 },
    { label: "Beavercreek", market: "Dayton Metro", coordinates: [-84.0633, 39.7092], priority: 3 },
    { label: "Xenia", market: "Dayton Metro", coordinates: [-83.9297, 39.6848], priority: 3 },
    { label: "Dublin", market: "Columbus Metro", coordinates: [-83.1141, 40.0992], priority: 2 },
    { label: "Westerville", market: "Columbus Metro", coordinates: [-82.9291, 40.1262], priority: 2 },
    { label: "Hilliard", market: "Columbus Metro", coordinates: [-83.1582, 40.0334], priority: 3 },
    { label: "Grove City", market: "Columbus Metro", coordinates: [-83.0929, 39.8815], priority: 3 },
    { label: "Gahanna", market: "Columbus Metro", coordinates: [-82.8793, 40.0192], priority: 3 },
    { label: "Reynoldsburg", market: "Columbus Metro", coordinates: [-82.8121, 39.9548], priority: 3 },
    { label: "Delaware", market: "Columbus Metro", coordinates: [-83.068, 40.2987], priority: 2 },
    { label: "Lancaster", market: "Columbus Metro", coordinates: [-82.5993, 39.7137], priority: 2 },
    { label: "Newark", market: "Columbus Metro", coordinates: [-82.4013, 40.0581], priority: 2 },
    { label: "Zanesville", market: "Zanesville-Newark Corridor", coordinates: [-82.0132, 39.9403], priority: 2 },
    { label: "Cambridge", market: "Zanesville-Newark Corridor", coordinates: [-81.5885, 40.0312], priority: 3 },
    { label: "Coshocton", market: "Zanesville-Newark Corridor", coordinates: [-81.8596, 40.272], priority: 3 },
    { label: "Mansfield", market: "Mansfield-Marion", coordinates: [-82.5154, 40.7584], priority: 2 },
    { label: "Marion", market: "Mansfield-Marion", coordinates: [-83.1285, 40.5887], priority: 2 },
    { label: "Mount Vernon", market: "Mansfield-Marion", coordinates: [-82.4857, 40.3934], priority: 3 },
    { label: "Bucyrus", market: "Mansfield-Marion", coordinates: [-82.9755, 40.8084], priority: 3 },
    { label: "Lima", market: "Lima-Findlay Corridor", coordinates: [-84.1052, 40.7426], priority: 2 },
    { label: "Findlay", market: "Lima-Findlay Corridor", coordinates: [-83.6502, 41.0442], priority: 2 },
    { label: "Sidney", market: "Lima-Findlay Corridor", coordinates: [-84.1555, 40.2842], priority: 3 },
    { label: "Troy", market: "Dayton Metro", coordinates: [-84.2033, 40.0395], priority: 3 },
    { label: "Piqua", market: "Lima-Findlay Corridor", coordinates: [-84.2424, 40.1448], priority: 3 },
    { label: "Van Wert", market: "Lima-Findlay Corridor", coordinates: [-84.5841, 40.8695], priority: 3 },
    { label: "Bowling Green", market: "Toledo Metro", coordinates: [-83.6508, 41.3748], priority: 2 },
    { label: "Fremont", market: "Sandusky-Erie Coast", coordinates: [-83.1149, 41.3503], priority: 3 },
    { label: "Sandusky", market: "Sandusky-Erie Coast", coordinates: [-82.7079, 41.4489], priority: 2 },
    { label: "Tiffin", market: "Sandusky-Erie Coast", coordinates: [-83.178, 41.1145], priority: 3 },
    { label: "Defiance", market: "Northwest Ohio", coordinates: [-84.3558, 41.2845], priority: 3 },
    { label: "Wooster", market: "Akron Corridor", coordinates: [-81.9351, 40.8051], priority: 2 },
    { label: "Medina", market: "Cleveland Metro", coordinates: [-81.8637, 41.1384], priority: 2 },
    { label: "Wadsworth", market: "Akron Corridor", coordinates: [-81.7299, 41.0256], priority: 3 },
    { label: "Warren", market: "Youngstown Valley", coordinates: [-80.8184, 41.2376], priority: 2 },
    { label: "Niles", market: "Youngstown Valley", coordinates: [-80.7654, 41.1828], priority: 3 },
    { label: "Ashtabula", market: "Ashtabula-Lake Erie", coordinates: [-80.7898, 41.8651], priority: 2 },
    { label: "Steubenville", market: "Ohio Valley", coordinates: [-80.634, 40.3698], priority: 2 },
    { label: "Chillicothe", market: "Southern Ohio", coordinates: [-82.9824, 39.3331], priority: 2 },
    { label: "Portsmouth", market: "Southern Ohio", coordinates: [-82.9977, 38.7317], priority: 2 },
    { label: "Athens", market: "Southeast Ohio", coordinates: [-82.1013, 39.3292], priority: 2 },
    { label: "Marietta", market: "Southeast Ohio", coordinates: [-81.4548, 39.4154], priority: 2 },
  ],
  illinois: [
    { label: "Chicago", market: "Chicago Metro", coordinates: [-87.6298, 41.8781], priority: 1 },
    { label: "Aurora", market: "Aurora-Joliet Corridor", coordinates: [-88.3201, 41.7606], priority: 1 },
    { label: "Joliet", market: "Aurora-Joliet Corridor", coordinates: [-88.0817, 41.525], priority: 1 },
    { label: "Naperville", market: "Chicago Metro", coordinates: [-88.1535, 41.7508], priority: 1 },
    { label: "Elgin", market: "Chicago Metro", coordinates: [-88.2826, 42.0354], priority: 2 },
    { label: "Waukegan", market: "Chicago Metro", coordinates: [-87.8448, 42.3636], priority: 2 },
    { label: "Cicero", market: "Chicago Metro", coordinates: [-87.7539, 41.8456], priority: 2 },
    { label: "Schaumburg", market: "Chicago Metro", coordinates: [-88.0834, 42.0334], priority: 2 },
    { label: "Evanston", market: "Chicago Metro", coordinates: [-87.6877, 42.0451], priority: 2 },
    { label: "Arlington Heights", market: "Chicago Metro", coordinates: [-87.9806, 42.0884], priority: 3 },
    { label: "Bolingbrook", market: "Aurora-Joliet Corridor", coordinates: [-88.0684, 41.6986], priority: 3 },
    { label: "Palatine", market: "Chicago Metro", coordinates: [-88.0342, 42.1103], priority: 3 },
    { label: "Skokie", market: "Chicago Metro", coordinates: [-87.7334, 42.0324], priority: 3 },
    { label: "Des Plaines", market: "Chicago Metro", coordinates: [-87.8878, 42.0334], priority: 3 },
    { label: "Orland Park", market: "Chicago Metro", coordinates: [-87.8539, 41.6303], priority: 3 },
    { label: "Oak Lawn", market: "Chicago Metro", coordinates: [-87.7581, 41.7199], priority: 3 },
    { label: "Kankakee", market: "Kankakee-Iroquois", coordinates: [-87.8612, 41.1200], priority: 2 },
    { label: "DeKalb", market: "Northwest Illinois", coordinates: [-88.7504, 41.9295], priority: 2 },
    { label: "Crystal Lake", market: "Chicago Metro", coordinates: [-88.3162, 42.2411], priority: 3 },
    { label: "Rockford", market: "Rockford Region", coordinates: [-89.094, 42.2711], priority: 1 },
    { label: "Peoria", market: "Peoria Region", coordinates: [-89.589, 40.6936], priority: 1 },
    { label: "Springfield", market: "Springfield Region", coordinates: [-89.6501, 39.7817], priority: 1 },
    { label: "Champaign", market: "Champaign-Urbana", coordinates: [-88.2434, 40.1164], priority: 1 },
    { label: "Urbana", market: "Champaign-Urbana", coordinates: [-88.2073, 40.1106], priority: 2 },
    { label: "Bloomington", market: "Bloomington-Normal", coordinates: [-88.9937, 40.4842], priority: 1 },
    { label: "Normal", market: "Bloomington-Normal", coordinates: [-88.9906, 40.5142], priority: 2 },
    { label: "Decatur", market: "Champaign-Urbana", coordinates: [-88.9548, 39.8403], priority: 2 },
    { label: "Quincy", market: "Quincy-Western Illinois", coordinates: [-91.4099, 39.9356], priority: 2 },
    { label: "Moline", market: "Quad Cities", coordinates: [-90.5151, 41.5067], priority: 2 },
    { label: "Rock Island", market: "Quad Cities", coordinates: [-90.5787, 41.5095], priority: 2 },
    { label: "Galesburg", market: "Peoria Region", coordinates: [-90.3712, 40.9478], priority: 3 },
    { label: "Danville", market: "Champaign-Urbana", coordinates: [-87.6300, 40.1245], priority: 3 },
    { label: "East St. Louis", market: "Metro East", coordinates: [-90.1509, 38.6245], priority: 1 },
    { label: "Belleville", market: "Metro East", coordinates: [-89.9840, 38.5201], priority: 2 },
    { label: "Edwardsville", market: "Metro East", coordinates: [-89.9532, 38.8114], priority: 2 },
    { label: "Alton", market: "Metro East", coordinates: [-90.1843, 38.8906], priority: 3 },
    { label: "O'Fallon", market: "Metro East", coordinates: [-89.9112, 38.5923], priority: 3 },
    { label: "Carbondale", market: "Southern Illinois", coordinates: [-89.2168, 37.7273], priority: 2 },
    { label: "Marion", market: "Southern Illinois", coordinates: [-88.9331, 37.7306], priority: 2 },
    { label: "Centralia", market: "Southern Illinois", coordinates: [-89.1334, 38.5250], priority: 3 },
  ],
  tennessee: [
    { label: "Nashville", market: "Nashville Metro", coordinates: [-86.7816, 36.1627], priority: 1 },
    { label: "Memphis", market: "Memphis Metro", coordinates: [-90.049, 35.1495], priority: 1 },
    { label: "Knoxville", market: "Knoxville Metro", coordinates: [-83.9207, 35.9606], priority: 1 },
    { label: "Chattanooga", market: "Chattanooga Metro", coordinates: [-85.3097, 35.0456], priority: 1 },
    { label: "Clarksville", market: "Clarksville Region", coordinates: [-87.3595, 36.5298], priority: 1 },
    { label: "Murfreesboro", market: "Murfreesboro-Franklin Corridor", coordinates: [-86.3903, 35.8456], priority: 1 },
    { label: "Franklin", market: "Murfreesboro-Franklin Corridor", coordinates: [-86.8689, 35.9251], priority: 1 },
    { label: "Hendersonville", market: "Nashville Metro", coordinates: [-86.6200, 36.3048], priority: 2 },
    { label: "Gallatin", market: "Nashville Metro", coordinates: [-86.4467, 36.3884], priority: 2 },
    { label: "Lebanon", market: "Nashville Metro", coordinates: [-86.2911, 36.2081], priority: 2 },
    { label: "Smyrna", market: "Murfreesboro-Franklin Corridor", coordinates: [-86.5186, 35.9828], priority: 2 },
    { label: "Brentwood", market: "Murfreesboro-Franklin Corridor", coordinates: [-86.7828, 36.0331], priority: 3 },
    { label: "Columbia", market: "Columbia-Shelbyville Corridor", coordinates: [-87.0353, 35.6151], priority: 2 },
    { label: "Spring Hill", market: "Columbia-Shelbyville Corridor", coordinates: [-86.93, 35.7512], priority: 3 },
    { label: "Shelbyville", market: "Columbia-Shelbyville Corridor", coordinates: [-86.4603, 35.4834], priority: 3 },
    { label: "Jackson", market: "Jackson Region", coordinates: [-88.8139, 35.6145], priority: 1 },
    { label: "Bartlett", market: "Memphis Metro", coordinates: [-89.8739, 35.2045], priority: 2 },
    { label: "Germantown", market: "Memphis Metro", coordinates: [-89.7930, 35.0868], priority: 2 },
    { label: "Collierville", market: "Memphis Metro", coordinates: [-89.6645, 35.0420], priority: 2 },
    { label: "Dyersburg", market: "Jackson Region", coordinates: [-89.3856, 36.0345], priority: 3 },
    { label: "Union City", market: "Jackson Region", coordinates: [-89.0570, 36.4242], priority: 3 },
    { label: "Martin", market: "Jackson Region", coordinates: [-88.8503, 36.3434], priority: 3 },
    { label: "Paris", market: "Jackson Region", coordinates: [-88.3267, 36.3020], priority: 3 },
    { label: "Johnson City", market: "Tri-Cities", coordinates: [-82.3535, 36.3134], priority: 1 },
    { label: "Kingsport", market: "Tri-Cities", coordinates: [-82.5618, 36.5484], priority: 2 },
    { label: "Bristol", market: "Tri-Cities", coordinates: [-82.1887, 36.5951], priority: 2 },
    { label: "Morristown", market: "Tri-Cities", coordinates: [-83.2949, 36.2139], priority: 3 },
    { label: "Greeneville", market: "Tri-Cities", coordinates: [-82.8309, 36.1632], priority: 3 },
    { label: "Cleveland", market: "Cleveland-Athens Corridor", coordinates: [-84.8766, 35.1595], priority: 2 },
    { label: "Athens", market: "Cleveland-Athens Corridor", coordinates: [-84.59299, 35.4429], priority: 3 },
    { label: "Tullahoma", market: "Columbia-Shelbyville Corridor", coordinates: [-86.2094, 35.3620], priority: 3 },
    { label: "Cookeville", market: "Cookeville-Cumberland Plateau", coordinates: [-85.5016, 36.1628], priority: 2 },
    { label: "Crossville", market: "Cookeville-Cumberland Plateau", coordinates: [-85.0269, 35.9489], priority: 3 },
    { label: "Maryville", market: "Knoxville Metro", coordinates: [-83.9705, 35.7565], priority: 2 },
    { label: "Oak Ridge", market: "Knoxville Metro", coordinates: [-84.2696, 36.0104], priority: 2 },
    { label: "Sevierville", market: "Knoxville Metro", coordinates: [-83.5618, 35.8681], priority: 3 },
    { label: "Dickson", market: "Nashville Metro", coordinates: [-87.3878, 36.0770], priority: 3 },
  ],
};

function resolveCityMarket(stateKey: StateKey, countyName: string, hash: number): string {
  const state = STATES[stateKey];
  const mappedMarket = CITY_MARKET_BY_STATE_AND_COUNTY[stateKey]?.[countyName];
  if (mappedMarket) return mappedMarket;
  if (CITY_MARKET_BY_STATE_AND_COUNTY[stateKey]) {
    return state.cityMarkets.at(-1) ?? `${state.label} Market`;
  }
  return state.cityMarkets[hash % state.cityMarkets.length] ?? `${state.label} Market`;
}

function politicalUnitForCounty(county: AtlasFeature, mode: PoliticalMode, stateKey: StateKey): PoliticalUnit {
  const state = STATES[stateKey];
  const countyId = normalizeId(county.id, 5);
  const countyName = county.properties?.name ?? `County ${countyId}`;
  const hash = hashText(`${stateKey}-${mode}-${countyId}`);
  const households = countyHouseholds(countyId);

  if (mode === "county") {
    const id = `${state.shortLabel}-county-${countyId}`;
    const partisanFields = countyElectionFields(countyId);
    return {
      id,
      label: `${countyName} County`,
      mode,
      countyIds: [countyId],
      households,
      ...partisanFields,
      confidence: partisanFields.partisanDataReady ? "Public Aggregate" : "Unavailable",
    };
  }

  if (mode === "zipcode") {
    const zone = state.zipSeed + (hash % 89);
    const id = `${state.shortLabel}-zip-${zone}`;
    return {
      id,
      label: `${state.shortLabel} ZIP ${zone}xx`,
      mode,
      countyIds: [countyId],
      households: Math.round(households * 0.82),
      ...neutralPartisanFields("ZIP coloring is neutral until USPS ZIP/ZCTA geometry is joined to source-backed aggregate election results."),
      confidence: "Estimated",
    };
  }

  if (mode === "city") {
    const market = resolveCityMarket(stateKey, countyName, hash);
    const id = cityUnitId(state, market);
    return {
      id,
      label: market,
      mode,
      countyIds: [countyId],
      households: Math.round(households * 0.9),
      ...neutralPartisanFields("City/metro coloring is neutral until municipal polygons are joined to source-backed aggregate election results."),
      confidence: "Estimated",
    };
  }

  const district = (hash % state.districtCount) + 1;
  const id = `${state.shortLabel}-district-${district}`;
  return {
    id,
    label: `${state.label} District ${district}`,
    mode,
    countyIds: [countyId],
    households: Math.round(households * 1.04),
    ...neutralPartisanFields("District coloring is neutral until official district boundaries are joined to source-backed aggregate election results."),
    confidence: "Estimated",
  };
}

function districtUnitId(state: (typeof STATES)[StateKey], layerKey: OfficialDistrictLayerKey, district: string) {
  return `${state.shortLabel}-${layerKey.replace("_", "-")}-district-${district}`;
}

function resolveActiveDistrictLayer(activePoliticalLayers: string[]): OfficialDistrictLayerKey {
  if (activePoliticalLayers.includes("State House District")) return "state_house";
  if (activePoliticalLayers.includes("State Senate District")) return "state_senate";
  if (activePoliticalLayers.includes("Congressional District")) return "congressional";
  return "congressional";
}

function getOfficialDistrictLayer(
  stateKey: StateKey,
  layerKey: OfficialDistrictLayerKey,
): (OfficialDistrictLayerInfo & { featureCollection: FeatureCollection<Geometry, DistrictFeatureProperties> }) | null {
  const stateData = OFFICIAL_DISTRICT_DATA_BY_STATE[stateKey];
  const layer = stateData?.layers[layerKey];
  if (!stateData || !layer) return null;

  return {
    key: layerKey,
    label: layer.label,
    sourceName: stateData.sourceName,
    sourceUrl: layer.sourceUrl || stateData.sourceUrl,
    sourceCycle: stateData.sourceCycle,
    featureCount: layer.featureCount,
    available: true,
    featureCollection: layer.featureCollection,
  };
}

function districtLayerNoun(layerKey: OfficialDistrictLayerKey) {
  if (layerKey === "state_house") return "State House District";
  if (layerKey === "state_senate") return "State Senate District";
  return "Congressional District";
}

function projectRing(
  ring: number[][],
  projection: ReturnType<typeof geoMercator>,
): Array<[number, number]> {
  return ring.flatMap((position) => {
    const [longitude, latitude] = position;
    if (typeof longitude !== "number" || typeof latitude !== "number") return [];

    const projected = projection([longitude, latitude]);
    return projected ? [projected as [number, number]] : [];
  });
}

function projectedRingsForGeometry(
  geometry: Geometry,
  projection: ReturnType<typeof geoMercator>,
): Array<Array<[number, number]>> {
  if (geometry.type === "Polygon") {
    return geometry.coordinates
      .map((ring) => projectRing(ring as number[][], projection))
      .filter((ring) => ring.length >= 3);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) =>
      polygon
        .map((ring) => projectRing(ring as number[][], projection))
        .filter((ring) => ring.length >= 3),
    );
  }

  return [];
}

function pointInRing(point: [number, number], ring: Array<[number, number]>) {
  let inside = false;
  const [x, y] = point;

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];
    if (!current || !previous) continue;

    const [xi, yi] = current;
    const [xj, yj] = previous;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInProjectedRings(point: [number, number], rings: Array<Array<[number, number]>>) {
  return rings.reduce((inside, ring) => (pointInRing(point, ring) ? !inside : inside), false);
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

function buildOfficialDistrictShapes(
  stateKey: StateKey,
  state: (typeof STATES)[StateKey],
  layer: (OfficialDistrictLayerInfo & { featureCollection: FeatureCollection<Geometry, DistrictFeatureProperties> }) | null,
  projection: ReturnType<typeof geoMercator>,
  path: ReturnType<typeof geoPath>,
): OfficialDistrictShape[] {
  if (!layer) return [];

  return layer.featureCollection.features
    .flatMap((districtFeature) => {
      const district = String(districtFeature.properties?.district ?? "").trim();
      if (!district || !districtFeature.geometry) return [];

      const projectedFeature = normalizeDistrictFeatureForProjection(districtFeature, path);
      const districtPath = path(projectedFeature) ?? "";
      const projectedRings = projectedRingsForGeometry(projectedFeature.geometry, projection);
      if (!districtPath || projectedRings.length === 0) return [];

      return [
        {
          id: `${state.shortLabel}-official-${layer.key}-${district}`,
          unitId: districtUnitId(state, layer.key, district),
          district,
          label: `${state.shortLabel} ${districtLayerNoun(layer.key)} ${district}`,
          summary:
            stateKey === "ohio"
              ? OHIO_CONGRESSIONAL_DISTRICT_SUMMARIES[district] ?? "Official congressional district boundary"
              : districtFeature.properties?.label ?? "Official district boundary",
          layerKey: layer.key,
          layerLabel: layer.label,
          sourceName: layer.sourceName,
          sourceUrl: layer.sourceUrl,
          path: districtPath,
          centroid: path.centroid(projectedFeature) as [number, number],
          projectedRings,
        },
      ];
    })
    .sort((a, b) => Number(a.district) - Number(b.district));
}

function officialDistrictUnitIdAtPoint(point: [number, number], districts: OfficialDistrictShape[]) {
  return districts.find((district) => pointInProjectedRings(point, district.projectedRings))?.unitId ?? null;
}

function buildCityMarkers(
  stateKey: StateKey,
  projection: ReturnType<typeof geoMercator>,
): CityMarker[] {
  const state = STATES[stateKey];

  return CITY_MARKERS_BY_STATE[stateKey].flatMap((marker) => {
    const projected = projection(marker.coordinates);
    if (!projected) return [];

    return [
      {
        ...marker,
        id: `${state.shortLabel}-city-marker-${slugifyMapLabel(marker.label)}`,
        unitId: cityUnitId(state, marker.market),
        position: projected as [number, number],
      },
    ];
  });
}

function routePolygon([x, y]: [number, number], seed: number, size: number) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index + Math.PI / 6;
    const radius = size + ((seed + index) % 3) * 1.4;
    return `${Math.round((x + Math.cos(angle) * radius) * 10) / 10},${Math.round((y + Math.sin(angle) * radius) * 10) / 10}`;
  });

  return points.join(" ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPerPostcard(total: number, pieces: number) {
  if (pieces <= 0) return "$0.00";
  return `$${(total / pieces).toFixed(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampMapView(view: MapViewState): MapViewState {
  const scale = clamp(view.scale, MIN_MAP_SCALE, MAX_MAP_SCALE);
  const visibleWidth = VIEWBOX.width / scale;
  const visibleHeight = VIEWBOX.height / scale;
  const maxX = Math.max(0, VIEWBOX.width - visibleWidth);
  const maxY = Math.max(0, VIEWBOX.height - visibleHeight);

  return {
    scale,
    x: clamp(view.x, 0, maxX),
    y: clamp(view.y, 0, maxY),
  };
}

function zoomMapViewAt(
  view: MapViewState,
  nextScale: number,
  anchor = { x: 0.5, y: 0.5 },
): MapViewState {
  const currentWidth = VIEWBOX.width / view.scale;
  const currentHeight = VIEWBOX.height / view.scale;
  const worldX = view.x + currentWidth * anchor.x;
  const worldY = view.y + currentHeight * anchor.y;
  const scale = clamp(nextScale, MIN_MAP_SCALE, MAX_MAP_SCALE);
  const nextWidth = VIEWBOX.width / scale;
  const nextHeight = VIEWBOX.height / scale;

  return clampMapView({
    scale,
    x: worldX - nextWidth * anchor.x,
    y: worldY - nextHeight * anchor.y,
  });
}

function colorForLean(lean: PartyLean, intensity: PoliticalUnit["intensity"], selected: boolean) {
  if (selected) {
    if (lean === "democrat") return "#2563eb";
    if (lean === "republican") return "#dc2626";
    return "#64748b";
  }

  if (lean === "democrat") {
    return intensity === "strong" ? "#93c5fd" : intensity === "medium" ? "#bfdbfe" : "#dbeafe";
  }

  if (lean === "republican") {
    return intensity === "strong" ? "#fca5a5" : intensity === "medium" ? "#fecaca" : "#fee2e2";
  }

  return "#e5e7eb";
}

function colorForPoliticalUnit(unit: PoliticalUnit, selected: boolean, showPartisanColor: boolean) {
  if (!showPartisanColor || !unit.partisanDataReady) {
    return selected ? "#f59e0b" : "#e5e7eb";
  }

  return colorForLean(unit.lean, unit.intensity, selected);
}

function estimatePostcardPricing(printQuantity: number) {
  if (printQuantity <= 0) {
    return {
      printCost: 0,
      postage: 0,
      service: 0,
      total: 0,
      pricePerPieceCents: 0,
    };
  }

  const billablePieces = Math.max(MINIMUM_TOTAL_PIECES, Math.floor(printQuantity));
  const pricePerPieceCents = resolvePoliticalPostcardPriceCents("local", billablePieces);
  const total = (billablePieces * pricePerPieceCents) / 100;
  const printCost = (billablePieces * Math.min(POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS, pricePerPieceCents)) / 100;
  const postage = (billablePieces * Math.min(POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS, pricePerPieceCents)) / 100;

  return {
    printCost,
    postage,
    service: Math.max(0, total - printCost - postage),
    total,
    pricePerPieceCents,
  };
}

function estimateCostForRoutes(routes: RouteUnit[], drops: number) {
  const households = routes.reduce((sum, route) => sum + route.households, 0);
  const deliveryPoints = routes.reduce((sum, route) => sum + route.deliveryPoints, 0);
  const printQuantity = households * drops;
  const pricing = estimatePostcardPricing(printQuantity);

  return {
    households,
    deliveryPoints,
    printQuantity,
    printCost: pricing.printCost,
    postage: pricing.postage,
    total: pricing.total,
  };
}

function buildPlanReadiness(
  stats: CampaignStats,
  selectedRoutes: RouteUnit[],
  selectedUnits: PoliticalUnit[],
): PlanReadinessItem[] {
  const hasRouteSelection = selectedRoutes.length > 0 || selectedUnits.length > 0;
  const priceComplete = stats.printQuantity > 0 && stats.total > 0 && Number.isFinite(stats.total);
  const printComplete = stats.printCost > 0 && Number.isFinite(stats.printCost);
  const postageComplete = stats.postage > 0 && Number.isFinite(stats.postage);
  const productionDataReady = stats.confidence === "Exact" || stats.confidence === "Paid Vendor Data";

  return [
    {
      id: "geography",
      label: "Geography or USPS route selected",
      complete: hasRouteSelection,
      detail: hasRouteSelection
        ? `${formatNumber(selectedRoutes.length)} synced USPS route cells selected.`
        : "Select a county, city, district, ZIP, or USPS route cell on the map.",
      blocksProposal: true,
      blocksCheckout: true,
    },
    {
      id: "households",
      label: "Household and delivery counts greater than zero",
      complete: stats.households > 0 && stats.deliveryPoints > 0 && stats.printQuantity > 0,
      detail: stats.households > 0
        ? `${formatNumber(stats.households)} households and ${formatNumber(stats.deliveryPoints)} delivery points in the preview.`
        : "The plan needs non-zero households, delivery points, and mail pieces.",
      blocksProposal: true,
      blocksCheckout: true,
    },
    {
      id: "price",
      label: "Pricing estimate calculated",
      complete: priceComplete,
      detail: priceComplete
        ? `${formatPerPostcard(stats.total, stats.printQuantity)} per postcard preview.`
        : "Select routes and drops so the pricing engine can calculate a subtotal.",
      blocksProposal: true,
      blocksCheckout: true,
    },
    {
      id: "print",
      label: "Print estimate calculated",
      complete: printComplete,
      detail: printComplete ? `${formatCurrency(stats.printCost)} print estimate.` : "Print estimate is missing.",
      blocksProposal: true,
      blocksCheckout: true,
    },
    {
      id: "postage",
      label: "Postage estimate calculated",
      complete: postageComplete,
      detail: postageComplete ? `${formatCurrency(stats.postage)} postage estimate.` : "Postage estimate is missing.",
      blocksProposal: true,
      blocksCheckout: true,
    },
    {
      id: "campaign-contact",
      label: "Campaign and contact details collected",
      complete: false,
      detail: "Complete the Plan tab so the proposal has candidate, race, contact, election date, and approval details.",
      blocksProposal: true,
      blocksCheckout: true,
    },
    {
      id: "verified-usps",
      label: "Verified USPS carrier-route data for checkout",
      complete: productionDataReady,
      detail: productionDataReady
        ? `${stats.confidence} data can support a production quote.`
        : "This public map uses demo/sample route cells. Verify live USPS counts before checkout or payment.",
      blocksCheckout: true,
    },
  ];
}

function actionBlockers(readiness: PlanReadinessItem[], action: "proposal" | "checkout") {
  return readiness.filter((item) =>
    action === "proposal" ? item.blocksProposal && !item.complete : item.blocksCheckout && !item.complete,
  );
}

function readinessProgress(readiness: PlanReadinessItem[]) {
  const complete = readiness.filter((item) => item.complete).length;
  return `${complete}/${readiness.length}`;
}

function matchesSearch(value: string | null | undefined, query: string) {
  return Boolean(value && value.toLowerCase().includes(query));
}

function buildMapSearchHits(query: string, mapData: ReturnType<typeof buildMapData>): MapSearchHit[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const routeHits = mapData.routes
    .filter((route) =>
      matchesSearch(route.label, normalized) ||
      matchesSearch(route.carrierRouteId, normalized) ||
      matchesSearch(route.zip5, normalized) ||
      matchesSearch(route.countyName, normalized),
    )
    .slice(0, 5)
    .map<MapSearchHit>((route) => ({
      kind: "route",
      id: `route-${route.id}`,
      label: route.label,
      detail: `${route.zip5}-${route.carrierRouteId} · ${formatNumber(route.households)} households`,
      route,
    }));

  const geographyHits = Array.from(mapData.units.values())
    .filter((unit) => matchesSearch(unit.label, normalized) || matchesSearch(unit.source, normalized))
    .slice(0, 5)
    .map<MapSearchHit>((unit) => ({
      kind: "geography",
      id: `geo-${unit.id}`,
      label: unit.label,
      detail: `${MODE_CONFIG[unit.mode].label} · ${formatNumber(unit.households)} estimated households`,
      unitId: unit.id,
      mode: unit.mode,
    }));

  const cityHits = mapData.cityMarkers
    .filter((marker) => matchesSearch(marker.label, normalized) || matchesSearch(marker.market, normalized))
    .slice(0, 5)
    .map<MapSearchHit>((marker) => ({
      kind: "city",
      id: `city-${marker.id}`,
      label: marker.label,
      detail: `${marker.market} city marker`,
      unitId: marker.unitId,
    }));

  return [...routeHits, ...geographyHits, ...cityHits].slice(0, 10);
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildCampaignHealth(
  stats: CampaignStats,
  selectedRoutes: RouteUnit[],
  selectedUnits: PoliticalUnit[],
  dropCount: number,
): CampaignHealth {
  const routeEfficiency = selectedRoutes.length > 0
    ? selectedRoutes.reduce((sum, route) => sum + route.households / Math.max(1, route.deliveryPoints), 0) / selectedRoutes.length
    : 0;
  const costPerHousehold = stats.households > 0 ? stats.total / stats.households : 0;
  const coverageScore = Math.min(34, stats.coveragePct * 0.55);
  const cadenceScore = dropCount >= 3 ? 20 : dropCount === 2 ? 15 : dropCount === 1 && stats.households > 0 ? 8 : 0;
  const efficiencyScore = selectedRoutes.length > 0 ? Math.min(18, routeEfficiency * 19) : 0;
  const budgetScore = costPerHousehold > 0 ? Math.max(0, Math.min(16, 18 - costPerHousehold * 7)) : 0;
  const dataScore = stats.confidence === "Exact"
    ? 12
    : stats.confidence === "Public Aggregate" || stats.confidence === "Paid Vendor Data"
      ? 10
      : stats.confidence === "Estimated"
        ? 7
        : stats.confidence === "Demo/Sample"
          ? 4
          : 0;
  const rawScore = Math.round(coverageScore + cadenceScore + efficiencyScore + budgetScore + dataScore);
  const score = Math.min(100, rawScore);
  const tone: HealthTone = score >= 75 ? "green" : score >= 45 ? "yellow" : "red";
  const label = tone === "green" ? "Strong" : tone === "yellow" ? "Vulnerable" : "Weak coverage";
  const summary =
    selectedRoutes.length === 0
      ? "Select geography to convert the map into an executable campaign plan."
      : tone === "green"
        ? "This plan has strong geographic reach, credible cadence, and efficient mail density."
        : tone === "yellow"
          ? "This plan is usable, but coverage, data confidence, or drop cadence should be tightened before proposal."
          : "This plan needs more geography, verified route data, or additional drops before it is campaign-ready.";

  return {
    score,
    tone,
    label,
    summary,
    factors: [
      {
        label: "Coverage",
        value: `${stats.coveragePct}%`,
        tone: stats.coveragePct >= 70 ? "green" : stats.coveragePct >= 35 ? "yellow" : "red",
      },
      {
        label: "Drop cadence",
        value: `${dropCount} wave${dropCount === 1 ? "" : "s"}`,
        tone: dropCount >= 3 ? "green" : dropCount === 2 ? "yellow" : "red",
      },
      {
        label: "Route efficiency",
        value: selectedRoutes.length > 0 ? `${Math.round(routeEfficiency * 100)}%` : "0%",
        tone: routeEfficiency >= 0.92 ? "green" : routeEfficiency >= 0.85 ? "yellow" : "red",
      },
      {
        label: "Geo units",
        value: formatNumber(selectedUnits.length),
        tone: selectedUnits.length >= 5 ? "green" : selectedUnits.length >= 2 ? "yellow" : "red",
      },
      {
        label: "Data readiness",
        value: stats.confidence,
        tone: stats.confidence === "Exact" || stats.confidence === "Paid Vendor Data" ? "green" : stats.confidence === "Unavailable" ? "red" : "yellow",
      },
    ],
  };
}

function buildTimeline(stats: CampaignStats, dropCount: number): TimelineItem[] {
  const today = new Date();
  const electionDay = new Date("2026-11-03T12:00:00");
  const earlyVoting = new Date("2026-10-06T12:00:00");
  const productionReady = addDays(today, 5);
  const mailPrep = addDays(today, 7);
  const inHomeStart = addDays(today, 15);
  const inHomeEnd = addDays(today, 22);

  return [
    {
      label: "Next action",
      dateLabel: "Now",
      status: stats.households > 0 ? "ready" : "next",
      detail: stats.households > 0 ? "Verify live USPS counts and convert this plan into a proposal." : "Select political geography or USPS routes.",
    },
    {
      label: "Printer deadline",
      dateLabel: formatShortDate(productionReady),
      status: stats.printQuantity > 0 ? "warning" : "next",
      detail: `${formatNumber(stats.printQuantity)} pieces across ${dropCount} wave${dropCount === 1 ? "" : "s"}.`,
    },
    {
      label: "USPS prep / BMEU",
      dateLabel: formatShortDate(mailPrep),
      status: "warning",
      detail: "Prepare bundles, trays/sacks, facing slips, and route documentation.",
    },
    {
      label: "Estimated in-home",
      dateLabel: `${formatShortDate(inHomeStart)}-${formatShortDate(inHomeEnd)}`,
      status: "ready",
      detail: "Marketing Mail delivery window estimate; confirm with production schedule.",
    },
    {
      label: "Early voting",
      dateLabel: formatShortDate(earlyVoting),
      status: "next",
      detail: "Recommended planning anchor for absentee and early-vote visibility.",
    },
    {
      label: "Election Day",
      dateLabel: formatShortDate(electionDay),
      status: "ready",
      detail: "Campaign timeline target.",
    },
  ];
}

function buildRecommendations(
  stats: CampaignStats,
  selectedRoutes: RouteUnit[],
  selectedUnits: PoliticalUnit[],
  dropCount: number,
  mapData: ReturnType<typeof buildMapData>,
): OpsRecommendation[] {
  const denseRoutes = mapData.routes
    .filter((route) => !selectedRoutes.some((selected) => selected.id === route.id))
    .sort((a, b) => b.households - a.households)
    .slice(0, 4);
  const mixedUnits = selectedUnits.filter((unit) => unit.partisanDataReady && unit.lean === "mixed").length;
  const unvalidatedPartisanUnits = selectedUnits.filter((unit) => !unit.partisanDataReady).length;
  const recs: OpsRecommendation[] = [];

  if (selectedRoutes.length === 0) {
    recs.push({
      title: "Start with the densest route bundle",
      body: denseRoutes.length > 0
        ? `Open with ${denseRoutes[0]?.countyName ?? "the highest-density area"} and adjacent routes to create immediate reach.`
        : "Import USPS route data to identify the densest launch bundle.",
      reason: "Campaigns move faster when the first plan is concrete, priced, and geographically obvious.",
      tone: "blue",
    });
  }

  if (stats.coveragePct > 0 && stats.coveragePct < 55) {
    recs.push({
      title: "Close the visible coverage gap",
      body: "Add adjacent routes before proposal so the campaign sees a stronger district-wide presence.",
      reason: "The current plan is below the coverage level most campaigns expect for a command-center proposal.",
      tone: "gold",
    });
  }

  if (dropCount < 2 && stats.households > 0) {
    recs.push({
      title: "Recommend a second mail wave",
      body: "Position this as visibility plus reinforcement instead of a one-time postcard buy.",
      reason: "Multiple touchpoints improve message recall and increase average order value without individual voter prediction.",
      tone: "green",
    });
  }

  if (mixedUnits > 0) {
    recs.push({
      title: "Use mixed aggregate areas as review zones",
      body: `${mixedUnits} selected geography ${mixedUnits === 1 ? "is" : "are"} gray/mixed. Review campaign-provided context before finalizing copy and cadence.`,
      reason: "Gray areas mean aggregate data is mixed, nonpartisan, or unavailable, not that individuals are unaffiliated.",
      tone: "blue",
    });
  }

  if (unvalidatedPartisanUnits > 0) {
    recs.push({
      title: "Keep unsourced toggles neutral",
      body: `${unvalidatedPartisanUnits} selected ${unvalidatedPartisanUnits === 1 ? "area needs" : "areas need"} a validated aggregate election source before red/blue coloring is shown.`,
      reason: "The map now avoids hash-based or demo partisan color on city, ZIP, district, and route layers.",
      tone: "gold",
    });
  }

  if (stats.confidence === "Demo/Sample") {
    recs.push({
      title: "Verify live USPS counts before checkout",
      body: "Use the map to sell the strategy, then replace demo route cells with official EDDM or licensed route counts for production.",
      reason: "Production confidence depends on current USPS route and deliverable-address data.",
      tone: "red",
    });
  }

  if (recs.length < 4 && stats.coveragePct >= 55) {
    recs.push({
      title: "Package into a proposal",
      body: "This plan is ready for a proposal draft once data confidence is upgraded from demo/sample.",
      reason: "Coverage, route count, and cost are clear enough for sales follow-up.",
      tone: "green",
    });
  }

  return recs.slice(0, 4);
}

function buildLiveFeed(
  stats: CampaignStats,
  selectedRoutes: RouteUnit[],
  health: CampaignHealth,
  saveStatus: SaveStatus,
): LiveFeedItem[] {
  return [
    {
      label: selectedRoutes.length > 0 ? "Routes selected" : "Plan awaiting selection",
      detail: selectedRoutes.length > 0
        ? `${formatNumber(selectedRoutes.length)} USPS routes staged for overlap review.`
        : "No routes selected yet.",
      tone: selectedRoutes.length > 0 ? "green" : "gold",
    },
    {
      label: "Campaign health updated",
      detail: `${health.score}/100, ${health.label.toLowerCase()}.`,
      tone: health.tone === "green" ? "green" : health.tone === "yellow" ? "gold" : "red",
    },
    {
      label: "Proposal value",
      detail: stats.total > 0 ? `${formatCurrency(stats.total)} estimated plan value.` : "Select coverage to calculate deal value.",
      tone: stats.total > 0 ? "blue" : "gold",
    },
    {
      label: "Data source status",
      detail: stats.confidence === "Demo/Sample"
        ? "Demo USPS routes active; production source verification required."
        : `${stats.confidence} data active.`,
      tone: stats.confidence === "Demo/Sample" ? "gold" : "green",
    },
    {
      label: "Save state",
      detail: saveStatus === "database" ? "Plan stored in Supabase." : saveStatus === "local_only" || saveStatus === "error" ? "Plan stored locally until Supabase migration is live." : "No saved snapshot in this session.",
      tone: saveStatus === "database" ? "green" : saveStatus === "idle" ? "gold" : "blue",
    },
  ];
}

function buildWhatIfOptions(
  stats: CampaignStats,
  selectedRoutes: RouteUnit[],
  dropCount: number,
  mapData: ReturnType<typeof buildMapData>,
): WhatIfOption[] {
  const selectedIds = new Set(selectedRoutes.map((route) => route.id));
  const gapFillRoutes = mapData.routes
    .filter((route) => !selectedIds.has(route.id))
    .sort((a, b) => b.households - a.households)
    .slice(0, 5);
  const saturationRoutes = mapData.routes
    .sort((a, b) => b.households - a.households)
    .slice(0, Math.max(12, selectedRoutes.length));
  const baseRoutes = selectedRoutes.length > 0 ? selectedRoutes : mapData.routes.slice(0, 6);
  const oneDrop = estimateCostForRoutes(baseRoutes, 1);
  const twoDrop = estimateCostForRoutes(baseRoutes, 2);
  const threeDrop = estimateCostForRoutes(baseRoutes, 3);
  const gapFill = estimateCostForRoutes([...selectedRoutes, ...gapFillRoutes], dropCount || 1);
  const saturation = estimateCostForRoutes(saturationRoutes, Math.max(dropCount, 2));

  return [
    {
      label: "Budget control",
      action: "set-drops-1",
      householdDelta: oneDrop.households - stats.households,
      routeDelta: baseRoutes.length - selectedRoutes.length,
      drops: 1,
      total: oneDrop.total,
      printQuantity: oneDrop.printQuantity,
      detail: "Keep the current geography but reduce to one decisive wave.",
    },
    {
      label: "Reinforcement wave",
      action: "set-drops-2",
      householdDelta: twoDrop.households - stats.households,
      routeDelta: baseRoutes.length - selectedRoutes.length,
      drops: 2,
      total: twoDrop.total,
      printQuantity: twoDrop.printQuantity,
      detail: "Run two waves for visibility plus message reinforcement.",
    },
    {
      label: "Election sprint",
      action: "set-drops-3",
      householdDelta: threeDrop.households - stats.households,
      routeDelta: baseRoutes.length - selectedRoutes.length,
      drops: 3,
      total: threeDrop.total,
      printQuantity: threeDrop.printQuantity,
      detail: "Three waves leading into early voting and Election Day.",
    },
    {
      label: "Gap fill",
      action: "expand-gap",
      householdDelta: gapFill.households - stats.households,
      routeDelta: gapFillRoutes.length,
      drops: dropCount,
      total: gapFill.total,
      printQuantity: gapFill.printQuantity,
      detail: "Add the five densest unselected routes to reduce visible gaps.",
    },
    {
      label: "Saturation push",
      action: "saturate-top",
      householdDelta: saturation.households - stats.households,
      routeDelta: Math.max(0, saturationRoutes.length - selectedRoutes.length),
      drops: Math.max(dropCount, 2),
      total: saturation.total,
      printQuantity: saturation.printQuantity,
      detail: "Preselect the strongest high-density route bundle.",
    },
  ];
}

function buildMapData(stateKey: StateKey, mode: PoliticalMode, activeDistrictLayer: OfficialDistrictLayerKey) {
  const state = STATES[stateKey];
  const counties = allCounties.filter((county) => normalizeId(county.id, 5).startsWith(state.fips));
  const selectedState = allStates.find((candidate) => normalizeId(candidate.id, 2) === state.fips);
  const officialDistrictLayer = getOfficialDistrictLayer(stateKey, activeDistrictLayer);
  const fallbackGeometry = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "GeometryCollection",
      geometries: counties.map((county) => county.geometry),
    },
  } as Feature<Geometry, GeoJsonProperties>;
  // Always fit to the state outline, even when drawing official district polygons.
  // Some official district exports include ring winding/multipart quirks; fitting
  // to the stable state boundary keeps districts visually anchored inside Ohio.
  const fitGeometry = selectedState ?? fallbackGeometry;
  const projection = geoMercator().fitExtent(
    [
      [28, 28],
      [VIEWBOX.width - 28, VIEWBOX.height - 28],
    ],
    fitGeometry,
  );
  const path = geoPath(projection);
  const cityMarkers = buildCityMarkers(stateKey, projection);
  const officialDistrictShapes = buildOfficialDistrictShapes(stateKey, state, officialDistrictLayer, projection, path);
  const units = new Map<string, PoliticalUnit>();
  const countyRows = counties.map((county) => {
    const countyId = normalizeId(county.id, 5);
    const currentUnit = politicalUnitForCounty(county, mode, stateKey);
    const existing = units.get(currentUnit.id);
    units.set(currentUnit.id, {
      ...currentUnit,
      countyIds: [...(existing?.countyIds ?? []), countyId],
      households: (existing?.households ?? 0) + currentUnit.households,
    });

    return {
      county,
      countyId,
      countyName: county.properties?.name ?? `County ${countyId}`,
      path: path(county) ?? "",
      centroid: path.centroid(county) as [number, number],
      unitByMode: {
        county: politicalUnitForCounty(county, "county", stateKey),
        zipcode: politicalUnitForCounty(county, "zipcode", stateKey),
        city: politicalUnitForCounty(county, "city", stateKey),
        district: politicalUnitForCounty(county, "district", stateKey),
      },
      unitId: currentUnit.id,
    };
  });

  const routes: RouteUnit[] = countyRows.flatMap((countyRow) => {
    const routeCount = 2 + (hashText(countyRow.countyId) % 3);
    return Array.from({ length: routeCount }, (_, index) => {
      const seed = hashText(`${countyRow.countyId}-${index}`);
      const angle = (Math.PI * 2 * index) / routeCount + (seed % 8) * 0.08;
      const distance = 18 + (seed % 19);
      const centroid: [number, number] = [
        countyRow.centroid[0] + Math.cos(angle) * distance,
        countyRow.centroid[1] + Math.sin(angle) * distance,
      ];
      const officialDistrictUnitId =
        officialDistrictShapes.length > 0 ? officialDistrictUnitIdAtPoint(centroid, officialDistrictShapes) : null;
      const carrierRouteNumber = String((seed % 899) + 1).padStart(3, "0");
      const zip5 = `${state.zipSeed}${String(seed % 100).padStart(2, "0")}`;
      const households = Math.round(countyHouseholds(countyRow.countyId) / routeCount);

      return {
        id: `${state.shortLabel}-${countyRow.countyId}-CR${carrierRouteNumber}`,
        label: `${zip5}-C${carrierRouteNumber}`,
        countyId: countyRow.countyId,
        countyName: countyRow.countyName,
        zip5,
        carrierRouteId: `C${carrierRouteNumber}`,
        routeType: seed % 4 === 0 ? "rural" : seed % 5 === 0 ? "general" : "city",
        households,
        deliveryPoints: Math.round(households * 1.08),
        polygon: routePolygon(centroid, seed, 13),
        centroid,
        confidence: "Demo/Sample",
        overlaps: {
          county: countyRow.unitByMode.county.id,
          zipcode: countyRow.unitByMode.zipcode.id,
          city: countyRow.unitByMode.city.id,
          district: officialDistrictUnitId ?? countyRow.unitByMode.district.id,
        },
      };
    });
  });

  if (mode === "district" && officialDistrictShapes.length > 0) {
    units.clear();
    const routeHouseholdsByDistrict = routes.reduce((districtHouseholds, route) => {
      districtHouseholds.set(route.overlaps.district, (districtHouseholds.get(route.overlaps.district) ?? 0) + route.households);
      return districtHouseholds;
    }, new Map<string, number>());

    for (const district of officialDistrictShapes) {
      units.set(district.unitId, {
        id: district.unitId,
        label: district.label,
        mode,
        countyIds: [],
        households: routeHouseholdsByDistrict.get(district.unitId) ?? 0,
        ...neutralPartisanFields(
          `${district.sourceName} (${district.layerLabel}). Partisan coloring is neutral until source-backed district-level election aggregates are imported for this map.`,
        ),
        confidence: "Unavailable",
      });
    }
  }

  return {
    state,
    statePath: selectedState ? path(selectedState) ?? "" : "",
    counties: countyRows,
    cityMarkers,
    officialDistrictLayer,
    officialDistrictShapes,
    units,
    routes,
  };
}

export function PoliticalInteractiveMap() {
  const [stateKey, setStateKey] = useState<StateKey>("ohio");
  const [mode, setMode] = useState<PoliticalMode>("county");
  const [dropCount, setDropCount] = useState(1);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [selectedPoliticalUnitDirectIds, setSelectedPoliticalUnitDirectIds] = useState<string[]>([]);
  const [hoveredPoliticalId, setHoveredPoliticalId] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [activePoliticalLayers, setActivePoliticalLayers] = useState<string[]>(["County", "Historical Vote Margin"]);
  const [activeUspsLayers, setActiveUspsLayers] = useState<string[]>(["Carrier Route Overlay", "Deliverable Address Count"]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [warRoomOpen, setWarRoomOpen] = useState(false);
  const [mapSearch, setMapSearch] = useState("");
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [proposalStatus, setProposalStatus] = useState<MapActionStatus>("idle");
  const [checkoutStatus, setCheckoutStatus] = useState<MapActionStatus>("idle");
  const [exportStatus, setExportStatus] = useState<MapActionStatus>("idle");

  const activeDistrictLayer = useMemo(
    () => resolveActiveDistrictLayer(activePoliticalLayers),
    [activePoliticalLayers],
  );
  const mapData = useMemo(
    () => buildMapData(stateKey, mode, activeDistrictLayer),
    [activeDistrictLayer, stateKey, mode],
  );
  const selectedRouteSet = useMemo(() => new Set(selectedRouteIds), [selectedRouteIds]);
  const selectedPoliticalUnitDirectSet = useMemo(
    () => new Set(selectedPoliticalUnitDirectIds),
    [selectedPoliticalUnitDirectIds],
  );
  const selectedRoutes = useMemo(
    () => mapData.routes.filter((route) => selectedRouteSet.has(route.id)),
    [mapData.routes, selectedRouteSet],
  );
  const selectedPoliticalUnitIds = useMemo(
    () => new Set([...selectedPoliticalUnitDirectSet, ...selectedRoutes.map((route) => route.overlaps[mode])]),
    [mode, selectedPoliticalUnitDirectSet, selectedRoutes],
  );
  const selectedUnits = useMemo(
    () =>
      Array.from(selectedPoliticalUnitIds)
        .map((id) => mapData.units.get(id))
        .filter((unit): unit is PoliticalUnit => Boolean(unit)),
    [mapData.units, selectedPoliticalUnitIds],
  );

  const stats = useMemo<CampaignStats>(() => {
    const households = selectedRoutes.reduce((sum, route) => sum + route.households, 0);
    const deliveryPoints = selectedRoutes.reduce((sum, route) => sum + route.deliveryPoints, 0);
    const totalHouseholds = Array.from(mapData.units.values()).reduce((sum, unit) => sum + unit.households, 0);
    const printQuantity = households * dropCount;
    const pricing = estimatePostcardPricing(printQuantity);
    const coveragePct = totalHouseholds > 0 ? Math.round((households / totalHouseholds) * 100) : 0;

    return {
      households,
      deliveryPoints,
      totalHouseholds,
      coveragePct,
      printQuantity,
      printCost: pricing.printCost,
      postage: pricing.postage,
      total: pricing.total,
      margin: pricing.service,
      confidence: selectedRoutes.length > 0 ? "Demo/Sample" as DataLabel : "Unavailable" as DataLabel,
    };
  }, [dropCount, mapData.units, selectedRoutes]);
  const health = useMemo(
    () => buildCampaignHealth(stats, selectedRoutes, selectedUnits, dropCount),
    [dropCount, selectedRoutes, selectedUnits, stats],
  );
  const timeline = useMemo(() => buildTimeline(stats, dropCount), [dropCount, stats]);
  const recommendations = useMemo(
    () => buildRecommendations(stats, selectedRoutes, selectedUnits, dropCount, mapData),
    [dropCount, mapData, selectedRoutes, selectedUnits, stats],
  );
  const liveFeed = useMemo(
    () => buildLiveFeed(stats, selectedRoutes, health, saveStatus),
    [health, saveStatus, selectedRoutes, stats],
  );
  const whatIfOptions = useMemo(
    () => buildWhatIfOptions(stats, selectedRoutes, dropCount, mapData),
    [dropCount, mapData, selectedRoutes, stats],
  );
  const readiness = useMemo(
    () => buildPlanReadiness(stats, selectedRoutes, selectedUnits),
    [selectedRoutes, selectedUnits, stats],
  );
  const searchHits = useMemo(() => buildMapSearchHits(mapSearch, mapData), [mapData, mapSearch]);

  const hoveredPolitical = hoveredPoliticalId ? mapData.units.get(hoveredPoliticalId) ?? null : null;
  const hoveredRoute = hoveredRouteId ? mapData.routes.find((route) => route.id === hoveredRouteId) ?? null : null;

  useEffect(() => {
    setSelectedPoliticalUnitDirectIds([]);
  }, [activeDistrictLayer, mode, stateKey]);

  function markPlanEdited(clearFeedback = true) {
    if (clearFeedback) setActionFeedback(null);
    setSavedAt(null);
    setSaveStatus("idle");
    setProposalStatus("idle");
    setCheckoutStatus("idle");
    setExportStatus("idle");
  }

  function updateDropCount(value: number) {
    markPlanEdited();
    setDropCount(value);
  }

  function selectPoliticalUnit(unitId: string, selectionMode = mode) {
    markPlanEdited();
    const matchingRouteIds = mapData.routes
      .filter((route) => route.overlaps[selectionMode] === unitId)
      .map((route) => route.id);
    const directlySelected = selectedPoliticalUnitDirectSet.has(unitId);
    const routesSelected = matchingRouteIds.length > 0 && matchingRouteIds.every((id) => selectedRouteSet.has(id));
    const shouldDeselect = directlySelected || routesSelected;

    setSelectedPoliticalUnitDirectIds((current) => {
      const next = new Set(current);
      if (shouldDeselect) next.delete(unitId);
      else next.add(unitId);
      return Array.from(next);
    });

    setSelectedRouteIds((current) => {
      const next = new Set(current);
      for (const routeId of matchingRouteIds) {
        if (shouldDeselect) next.delete(routeId);
        else next.add(routeId);
      }
      return Array.from(next);
    });
  }

  function selectUspsRoute(route: RouteUnit) {
    markPlanEdited();
    setSelectedRouteIds((current) => {
      const next = new Set(current);
      if (next.has(route.id)) next.delete(route.id);
      else next.add(route.id);
      return Array.from(next);
    });
  }

  function resetMap() {
    setSelectedRouteIds([]);
    setSelectedPoliticalUnitDirectIds([]);
    setHoveredPoliticalId(null);
    setHoveredRouteId(null);
    setSavedAt(null);
    setSaveStatus("idle");
    setActionFeedback(null);
    setProposalStatus("idle");
    setCheckoutStatus("idle");
    setExportStatus("idle");
  }

  async function savePlanSnapshot() {
    setSaveStatus("saving");
    const snapshot = {
      state: mapData.state.shortLabel,
      mode,
      dropCount,
      selectedLayers: {
        political: activePoliticalLayers,
        usps: activeUspsLayers,
      },
      selectedRoutes,
      selectedPoliticalGeographies: Array.from(selectedPoliticalUnitIds)
        .map((id) => mapData.units.get(id))
        .filter(Boolean),
      health,
      timeline,
      recommendations,
      liveFeed,
      households: stats.households,
      deliveryPoints: stats.deliveryPoints,
      printQuantity: stats.printQuantity,
      stats,
      totalCost: stats.total,
      dataConfidence: stats.confidence,
      generatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem("homereach:political-map-plan", JSON.stringify(snapshot));
    setSavedAt(new Date().toLocaleTimeString());

    try {
      const response = await fetch("/api/political/map-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; stored?: SaveStatus } | null;
      if (result?.ok && result.stored === "database") {
        setSaveStatus("database");
      } else {
        setSaveStatus("local_only");
      }
    } catch {
      setSaveStatus("error");
    }
  }

  function selectSearchHit(hit: MapSearchHit) {
    setActionFeedback(null);
    if (hit.kind === "route") {
      selectUspsRoute(hit.route);
      return;
    }

    if (hit.kind === "geography") {
      setMode(hit.mode);
      selectPoliticalUnit(hit.unitId, hit.mode);
    } else {
      setMode("city");
      selectPoliticalUnit(hit.unitId, "city");
    }
  }

  async function handleProposalAction() {
    const blockers = actionBlockers(readiness, "proposal");
    if (blockers.length > 0) {
      setProposalStatus("error");
      setActionFeedback({
        tone: "warning",
        title: "Proposal needs a few items first",
        body: "Your map selection can be saved as a planning snapshot, but a client-facing proposal needs campaign/contact details and complete route pricing.",
        checklist: blockers,
        href: "/political/plan?from=maps&intent=generate_proposal",
        hrefLabel: "Complete campaign details",
      });
      return;
    }

    setProposalStatus("working");
    await savePlanSnapshot();
    setProposalStatus("success");
    setActionFeedback({
      tone: "success",
      title: "Proposal snapshot ready",
      body: "The map plan was saved. Continue to the Plan tab to attach campaign details and submit it for proposal review.",
      href: "/political/plan?from=maps&intent=generate_proposal",
      hrefLabel: "Continue to proposal",
    });
  }

  async function handleCheckoutAction() {
    const blockers = actionBlockers(readiness, "checkout");
    if (blockers.length > 0) {
      setCheckoutStatus("error");
      setActionFeedback({
        tone: "warning",
        title: "Checkout is protected",
        body: "Stripe checkout is blocked until this is a verified production quote. Demo/sample map counts cannot create a payment link.",
        checklist: blockers,
        href: "/political/plan?from=maps",
        hrefLabel: "Start verified plan",
      });
      return;
    }

    setCheckoutStatus("working");
    await savePlanSnapshot();
    setCheckoutStatus("success");
    setActionFeedback({
      tone: "success",
      title: "Checkout handoff ready",
      body: "The verified plan is ready for a protected checkout handoff.",
    });
  }

  function exportRoutesCsv() {
    if (selectedRoutes.length === 0) {
      setExportStatus("error");
      setActionFeedback({
        tone: "warning",
        title: "Select routes before exporting",
        body: "Choose at least one political geography or USPS route cell, then export the route list.",
      });
      return;
    }

    const header = ["route_id", "zip5", "carrier_route", "county", "households", "delivery_points", "data_confidence"];
    const rows = selectedRoutes.map((route) => [
      route.id,
      route.zip5,
      route.carrierRouteId,
      route.countyName,
      route.households,
      route.deliveryPoints,
      route.confidence,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadTextFile("homereach-political-routes.csv", csv, "text/csv;charset=utf-8");
    setExportStatus("success");
    setActionFeedback({
      tone: "success",
      title: "Route CSV exported",
      body: `${formatNumber(selectedRoutes.length)} selected route records were downloaded for planning review.`,
    });
  }

  function exportPlanSummary() {
    if (selectedRoutes.length === 0) {
      setExportStatus("error");
      setActionFeedback({
        tone: "warning",
        title: "Select coverage before exporting",
        body: "The summary export needs at least one selected geography or USPS route cell.",
      });
      return;
    }

    const summary = {
      state: mapData.state.label,
      mode,
      drops: dropCount,
      generatedAt: new Date().toISOString(),
      dataConfidence: stats.confidence,
      warning: "Public map summary only. Demo/sample counts are not production checkout values.",
      stats,
      selectedRoutes: selectedRoutes.map((route) => ({
        id: route.id,
        label: route.label,
        zip5: route.zip5,
        carrierRouteId: route.carrierRouteId,
        households: route.households,
        deliveryPoints: route.deliveryPoints,
        confidence: route.confidence,
      })),
      readiness,
    };

    downloadTextFile("homereach-political-plan-summary.json", JSON.stringify(summary, null, 2), "application/json;charset=utf-8");
    setExportStatus("success");
    setActionFeedback({
      tone: "success",
      title: "Plan summary exported",
      body: "The planning summary was downloaded as JSON with data confidence and checkout warnings included.",
    });
  }

  function applyWhatIf(action: WhatIfAction) {
    markPlanEdited(false);
    const actionText: Record<WhatIfAction, string> = {
      "set-drops-1": "Mail drops changed to 1. This updates the preview only and does not save a production commitment.",
      "set-drops-2": "Mail drops changed to 2. This updates the preview only and does not save a production commitment.",
      "set-drops-3": "Mail drops changed to 3. This updates the preview only and does not save a production commitment.",
      "expand-gap": "Added the next highest-household demo route cells to model gap coverage. Verify USPS data before quoting.",
      "saturate-top": "Selected the densest demo route cells and set at least 2 drops. Verify USPS data before quoting.",
    };

    if (action === "set-drops-1") {
      setDropCount(1);
      setActionFeedback({ tone: "success", title: "Simulation applied", body: actionText[action] });
      return;
    }

    if (action === "set-drops-2") {
      setDropCount(2);
      setActionFeedback({ tone: "success", title: "Simulation applied", body: actionText[action] });
      return;
    }

    if (action === "set-drops-3") {
      setDropCount(3);
      setActionFeedback({ tone: "success", title: "Simulation applied", body: actionText[action] });
      return;
    }

    if (action === "expand-gap") {
      const current = new Set(selectedRouteIds);
      const additions = mapData.routes
        .filter((route) => !current.has(route.id))
        .sort((a, b) => b.households - a.households)
        .slice(0, 5)
        .map((route) => route.id);
      setSelectedRouteIds(Array.from(new Set([...selectedRouteIds, ...additions])));
      setActionFeedback({ tone: "success", title: "Simulation applied", body: actionText[action] });
      return;
    }

    const saturationRoutes = mapData.routes
      .sort((a, b) => b.households - a.households)
      .slice(0, Math.max(12, selectedRouteIds.length))
      .map((route) => route.id);
    setDropCount((current) => Math.max(current, 2));
    setSelectedRouteIds(saturationRoutes);
    setActionFeedback({ tone: "success", title: "Simulation applied", body: actionText[action] });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#071426] text-white shadow-2xl shadow-blue-950/30">
      <TopBar
        stateLabel={mapData.state.label}
        households={stats.households}
        totalCost={stats.total}
        confidence={stats.confidence}
        selectedCount={selectedRoutes.length}
        health={health}
        savedAt={savedAt}
        saveStatus={saveStatus}
        readiness={readiness}
        proposalStatus={proposalStatus}
        checkoutStatus={checkoutStatus}
        onSave={savePlanSnapshot}
        onProposal={handleProposalAction}
        onCheckout={handleCheckoutAction}
        onWarRoom={() => setWarRoomOpen(true)}
      />

      <div className="grid min-h-[760px] lg:grid-cols-[300px_minmax(0,1fr)_330px]">
        <LayerTogglePanel
          stateKey={stateKey}
          mode={mode}
          searchValue={mapSearch}
          searchResults={searchHits}
          onSearchChange={setMapSearch}
          onSelectSearchHit={selectSearchHit}
          onModeChange={setMode}
          politicalLayers={activePoliticalLayers}
          uspsLayers={activeUspsLayers}
          onTogglePolitical={(layer) => {
            setActivePoliticalLayers((current) => {
              const isActive = current.includes(layer);
              if (DISTRICT_LAYER_BY_LABEL[layer]) {
                const withoutDistrictLayers = current.filter((item) => !DISTRICT_LAYER_BY_LABEL[item]);
                return isActive ? withoutDistrictLayers : [...withoutDistrictLayers, layer];
              }
              return isActive ? current.filter((item) => item !== layer) : [...current, layer];
            });
            const nextMode = DISTRICT_LAYER_MODE_BY_LABEL[layer];
            if (nextMode) setMode(nextMode);
          }}
          onToggleUsps={(layer) =>
            setActiveUspsLayers((current) =>
              current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer],
            )
          }
        />

        <SyncedMapController
          stateKey={stateKey}
          setStateKey={(next) => {
            setStateKey(next);
            setSelectedRouteIds([]);
            setSelectedPoliticalUnitDirectIds([]);
            setHoveredPoliticalId(null);
            setHoveredRouteId(null);
            markPlanEdited();
          }}
          mode={mode}
          mapData={mapData}
          selectedPoliticalUnitIds={selectedPoliticalUnitIds}
          selectedRouteSet={selectedRouteSet}
          hoveredPolitical={hoveredPolitical}
          hoveredRoute={hoveredRoute}
          activePoliticalLayers={activePoliticalLayers}
          activeUspsLayers={activeUspsLayers}
          onPoliticalHover={setHoveredPoliticalId}
          onRouteHover={setHoveredRouteId}
          onPoliticalSelect={selectPoliticalUnit}
          onRouteSelect={selectUspsRoute}
          onReset={resetMap}
        />

        <SelectionSummaryPanel
          mode={mode}
          dropCount={dropCount}
          setDropCount={updateDropCount}
          selectedRoutes={selectedRoutes}
          selectedUnits={selectedUnits}
          stats={stats}
          saveStatus={saveStatus}
          readiness={readiness}
          actionFeedback={actionFeedback}
          proposalStatus={proposalStatus}
          checkoutStatus={checkoutStatus}
          onSave={savePlanSnapshot}
          onProposal={handleProposalAction}
          onCheckout={handleCheckoutAction}
        />
      </div>

      <OperationalCommandDeck
        health={health}
        timeline={timeline}
        recommendations={recommendations}
        liveFeed={liveFeed}
        whatIfOptions={whatIfOptions}
        onApplyWhatIf={applyWhatIf}
      />

      <CampaignPlanDrawer
        selectedRoutes={selectedRoutes}
        stats={stats}
        confidence={stats.confidence}
        readiness={readiness}
        actionFeedback={actionFeedback}
        exportStatus={exportStatus}
        onExportCsv={exportRoutesCsv}
        onExportSummary={exportPlanSummary}
      />

      {warRoomOpen && (
        <WarRoomOverlay
          stateKey={stateKey}
          setStateKey={(next) => {
            setStateKey(next);
            setSelectedRouteIds([]);
            setSelectedPoliticalUnitDirectIds([]);
            setHoveredPoliticalId(null);
            setHoveredRouteId(null);
            markPlanEdited();
          }}
          mode={mode}
          mapData={mapData}
          selectedPoliticalUnitIds={selectedPoliticalUnitIds}
          selectedRouteSet={selectedRouteSet}
          hoveredPolitical={hoveredPolitical}
          hoveredRoute={hoveredRoute}
          activePoliticalLayers={activePoliticalLayers}
          activeUspsLayers={activeUspsLayers}
          health={health}
          stats={stats}
          timeline={timeline}
          recommendations={recommendations}
          liveFeed={liveFeed}
          whatIfOptions={whatIfOptions}
          onPoliticalHover={setHoveredPoliticalId}
          onRouteHover={setHoveredRouteId}
          onPoliticalSelect={selectPoliticalUnit}
          onRouteSelect={selectUspsRoute}
          onReset={resetMap}
          onClose={() => setWarRoomOpen(false)}
          onApplyWhatIf={applyWhatIf}
        />
      )}
    </div>
  );
}

function TopBar({
  stateLabel,
  households,
  totalCost,
  confidence,
  selectedCount,
  health,
  savedAt,
  saveStatus,
  readiness,
  proposalStatus,
  checkoutStatus,
  onSave,
  onProposal,
  onCheckout,
  onWarRoom,
}: {
  stateLabel: string;
  households: number;
  totalCost: number;
  confidence: DataLabel;
  selectedCount: number;
  health: CampaignHealth;
  savedAt: string | null;
  saveStatus: SaveStatus;
  readiness: PlanReadinessItem[];
  proposalStatus: MapActionStatus;
  checkoutStatus: MapActionStatus;
  onSave: () => void | Promise<void>;
  onProposal: () => void | Promise<void>;
  onCheckout: () => void | Promise<void>;
  onWarRoom: () => void;
}) {
  const saveLabel =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "database"
        ? `Saved to database ${savedAt ?? ""}`.trim()
        : saveStatus === "local_only" || saveStatus === "error"
          ? `Saved locally ${savedAt ?? ""}`.trim()
          : "Save plan";

  return (
    <header className="border-b border-white/10 bg-[linear-gradient(135deg,#071426_0%,#0B1F3A_48%,#16233a_100%)] px-5 py-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">
            Dual Map Command Center
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Political geography synced to USPS mail execution
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-200">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Campaign: Demo Planning Session</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Candidate: Not selected</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Office: Pending intake</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Election date: Add in plan</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[620px]">
          <TopMetric label="State" value={stateLabel} />
          <TopMetric label="Routes" value={formatNumber(selectedCount)} />
          <TopMetric label="Households" value={formatNumber(households)} />
          <TopMetric label="Health" value={`${health.score}/100`} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DataConfidenceBadge label={confidence} />
          <HealthPill health={health} />
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-200">
            Estimate {formatCurrency(totalCost)}
          </span>
          <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-100">
            Readiness {readinessProgress(readiness)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Expand} label="War Room" onClick={onWarRoom} />
          <ActionButton icon={Save} label={saveLabel} onClick={onSave} />
          <ActionButton
            icon={FileText}
            label={proposalStatus === "working" ? "Checking proposal" : "Generate proposal"}
            state={proposalStatus === "working" ? "loading" : proposalStatus}
            onClick={onProposal}
            disabledReason={actionBlockers(readiness, "proposal").length > 0 ? "Complete the readiness checklist before proposal handoff." : undefined}
          />
          <ActionButton
            icon={CreditCard}
            label={checkoutStatus === "working" ? "Checking checkout" : "Create Stripe checkout"}
            state={checkoutStatus === "working" ? "loading" : checkoutStatus}
            onClick={onCheckout}
            disabledReason={actionBlockers(readiness, "checkout").length > 0 ? "Checkout requires verified production data and campaign details." : undefined}
          />
        </div>
      </div>
    </header>
  );
}

function TopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-lg font-black text-white">{value}</div>
    </div>
  );
}

function HealthPill({ health }: { health: CampaignHealth }) {
  const tone =
    health.tone === "green"
      ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
      : health.tone === "yellow"
        ? "border-amber-300/30 bg-amber-500/10 text-amber-100"
        : "border-red-300/30 bg-red-500/10 text-red-100";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${tone}`}>
      <Activity className="h-3.5 w-3.5" />
      {health.label}
    </span>
  );
}

function LayerTogglePanel({
  stateKey,
  mode,
  searchValue,
  searchResults,
  onSearchChange,
  onSelectSearchHit,
  onModeChange,
  politicalLayers,
  uspsLayers,
  onTogglePolitical,
  onToggleUsps,
}: {
  stateKey: StateKey;
  mode: PoliticalMode;
  searchValue: string;
  searchResults: MapSearchHit[];
  onSearchChange: (value: string) => void;
  onSelectSearchHit: (hit: MapSearchHit) => void;
  onModeChange: (mode: PoliticalMode) => void;
  politicalLayers: string[];
  uspsLayers: string[];
  onTogglePolitical: (layer: string) => void;
  onToggleUsps: (layer: string) => void;
}) {
  return (
    <aside className="border-b border-white/10 bg-slate-950 p-4 lg:border-b-0 lg:border-r">
      <div>
        <label className="sr-only" htmlFor="political-map-search">
          Search state, county, ZIP, route
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 focus-within:border-blue-300/50">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            id="political-map-search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search county, city, ZIP, route"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
        {searchValue.trim().length >= 2 && (
          <div className="mt-2 rounded-lg border border-white/10 bg-slate-900 p-2">
            {searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => onSelectSearchHit(hit)}
                    className="w-full rounded-md px-2 py-2 text-left transition hover:bg-blue-500/15"
                  >
                    <span className="block text-xs font-black text-white">{hit.label}</span>
                    <span className="block text-[11px] leading-4 text-slate-400">{hit.detail}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2 py-2 text-xs leading-5 text-slate-400">
                No matching geography or route in the loaded public map preview.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Selection Toggle</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(MODE_CONFIG) as PoliticalMode[]).map((key) => {
            const Icon = MODE_CONFIG[key].icon;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => onModeChange(key)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition ${
                  mode === key
                    ? "border-red-300 bg-red-600 text-white shadow-lg shadow-red-600/25"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {MODE_CONFIG[key].label}
              </button>
            );
          })}
        </div>
      </div>

      <ScrollableLayerGroup
        stateKey={stateKey}
        title="Political Campaign Map"
        groups={POLITICAL_LAYERS}
        active={politicalLayers}
        onToggle={onTogglePolitical}
      />
      <ScrollableLayerGroup
        stateKey={stateKey}
        title="USPS Mail Map"
        groups={USPS_LAYERS}
        active={uspsLayers}
        onToggle={onToggleUsps}
      />
    </aside>
  );
}

function ScrollableLayerGroup({
  stateKey,
  title,
  groups,
  active,
  onToggle,
}: {
  stateKey: StateKey;
  title: string;
  groups: Array<{ group: string; items: string[] }>;
  active: string[];
  onToggle: (layer: string) => void;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</h3>
      <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.group}>
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
              {group.group}
            </div>
            <div className="space-y-1.5">
              {group.items.map((layer) => {
                const isActive = active.includes(layer);
                const source = getLayerSourceMeta(layer, stateKey);
                const sourceTitle = `${source.sourceName}: ${source.note}`;

                return (
                  <div
                    key={layer}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition ${
                      isActive
                        ? "border-blue-300/40 bg-blue-500/15 text-blue-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onToggle(layer)}
                      title={sourceTitle}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate">{layer}</span>
                    </button>
                    {source.url && (
                      <a
                        href={source.url}
                        target={source.url.startsWith("/") ? undefined : "_blank"}
                        rel={source.url.startsWith("/") ? undefined : "noreferrer"}
                        title={`Open source: ${source.sourceName}`}
                        aria-label={`Open source for ${layer}`}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/10 text-slate-400 transition hover:border-blue-300/40 hover:text-blue-100"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <span
                      title={sourceTitle}
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${layerSourceTone(source.status)}`}
                    >
                      {source.badge}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncedMapController({
  stateKey,
  setStateKey,
  mode,
  mapData,
  selectedPoliticalUnitIds,
  selectedRouteSet,
  hoveredPolitical,
  hoveredRoute,
  activePoliticalLayers,
  activeUspsLayers,
  onPoliticalHover,
  onRouteHover,
  onPoliticalSelect,
  onRouteSelect,
  onReset,
}: {
  stateKey: StateKey;
  setStateKey: (key: StateKey) => void;
  mode: PoliticalMode;
  mapData: ReturnType<typeof buildMapData>;
  selectedPoliticalUnitIds: Set<string>;
  selectedRouteSet: Set<string>;
  hoveredPolitical: PoliticalUnit | null;
  hoveredRoute: RouteUnit | null;
  activePoliticalLayers: string[];
  activeUspsLayers: string[];
  onPoliticalHover: (id: string | null) => void;
  onRouteHover: (id: string | null) => void;
  onPoliticalSelect: (id: string) => void;
  onRouteSelect: (route: RouteUnit) => void;
  onReset: () => void;
}) {
  const [mapView, setMapView] = useState<MapViewState>(DEFAULT_MAP_VIEW);
  const viewResetKey = `${stateKey}-${mode}-${mapData.officialDistrictLayer?.key ?? "none"}`;
  const zoomIn = () => setMapView((current) => zoomMapViewAt(current, current.scale * 1.35));
  const zoomOut = () => setMapView((current) => zoomMapViewAt(current, current.scale / 1.35));
  const resetView = () => setMapView(DEFAULT_MAP_VIEW);

  useEffect(() => {
    setMapView(DEFAULT_MAP_VIEW);
  }, [viewResetKey]);

  return (
    <main className="space-y-4 bg-[#101726] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATES) as StateKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={stateKey === key}
              onClick={() => {
                setStateKey(key);
                resetView();
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                stateKey === key
                  ? "border-blue-300 bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {STATES[key].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            resetView();
            onReset();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
          Reset selections
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PoliticalMap
          mode={mode}
          mapData={mapData}
          mapView={mapView}
          selectedPoliticalUnitIds={selectedPoliticalUnitIds}
          selectedRouteSet={selectedRouteSet}
          activePoliticalLayers={activePoliticalLayers}
          onViewChange={setMapView}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
          onHover={onPoliticalHover}
          onSelect={onPoliticalSelect}
        />
        <USPSMap
          mode={mode}
          mapData={mapData}
          mapView={mapView}
          selectedPoliticalUnitIds={selectedPoliticalUnitIds}
          selectedRouteSet={selectedRouteSet}
          activeUspsLayers={activeUspsLayers}
          onViewChange={setMapView}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetView={resetView}
          onHover={onRouteHover}
          onSelect={onRouteSelect}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <HoverCard
          title="Political selection"
          value={hoveredPolitical?.label ?? "Hover or click a political geography"}
          detail={hoveredPolitical ? `${formatNumber(hoveredPolitical.households)} estimated households, ${hoveredPolitical.confidence}` : "Selecting an area highlights overlapping USPS routes."}
        />
        <HoverCard
          title="USPS route"
          value={hoveredRoute?.label ?? "Hover or click a carrier route"}
          detail={hoveredRoute ? `${formatNumber(hoveredRoute.deliveryPoints)} delivery points in ${hoveredRoute.countyName}` : "Selecting a route highlights its matching political geography."}
        />
      </div>
    </main>
  );
}

function OperationalCommandDeck({
  health,
  timeline,
  recommendations,
  liveFeed,
  whatIfOptions,
  onApplyWhatIf,
}: {
  health: CampaignHealth;
  timeline: TimelineItem[];
  recommendations: OpsRecommendation[];
  liveFeed: LiveFeedItem[];
  whatIfOptions: WhatIfOption[];
  onApplyWhatIf: (action: WhatIfAction) => void;
}) {
  return (
    <section className="border-t border-white/10 bg-[#071426] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-200">
            Political Mail Command Center
          </p>
          <h3 className="mt-1 text-xl font-black text-white">Operational intelligence</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
          <Radio className="h-3.5 w-3.5" />
          Live planning mode
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.15fr_1fr]">
        <CampaignHealthPanel health={health} />
        <TimelinePanel timeline={timeline} />
        <AiDirectorPanel recommendations={recommendations} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.45fr]">
        <LiveFeedPanel liveFeed={liveFeed} />
        <WhatIfSimulator options={whatIfOptions} onApply={onApplyWhatIf} />
      </div>
    </section>
  );
}

function CampaignHealthPanel({ health }: { health: CampaignHealth }) {
  const tone =
    health.tone === "green"
      ? "border-emerald-300/25 bg-emerald-500/10"
      : health.tone === "yellow"
        ? "border-amber-300/25 bg-amber-500/10"
        : "border-red-300/25 bg-red-500/10";

  return (
    <section className={`rounded-2xl border p-4 shadow-xl shadow-slate-950/30 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-white">
            <BarChart3 className="h-4 w-4 text-blue-200" />
            Campaign Health Score
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{health.summary}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-white">{health.score}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">of 100</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {health.factors.map((factor) => (
          <HealthFactor key={factor.label} factor={factor} />
        ))}
      </div>
    </section>
  );
}

function HealthFactor({ factor }: { factor: CampaignHealth["factors"][number] }) {
  const tone =
    factor.tone === "green"
      ? "bg-emerald-400"
      : factor.tone === "yellow"
        ? "bg-amber-300"
        : "bg-red-400";

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{factor.label}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      </div>
      <div className="mt-1 text-sm font-black text-white">{factor.value}</div>
    </div>
  );
}

function TimelinePanel({ timeline }: { timeline: TimelineItem[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/30">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <CalendarClock className="h-4 w-4 text-amber-200" />
        Campaign Timeline Engine
      </div>
      <div className="mt-4 space-y-3">
        {timeline.map((item) => (
          <div key={item.label} className="grid grid-cols-[88px_1fr] gap-3">
            <div className="text-right">
              <div className="text-xs font-black text-white">{item.dateLabel}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{item.status}</div>
            </div>
            <div className="relative border-l border-white/10 pl-4">
              <span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full ${item.status === "ready" ? "bg-emerald-300" : item.status === "warning" ? "bg-amber-300" : "bg-blue-300"}`} />
              <div className="text-sm font-black text-white">{item.label}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiDirectorPanel({ recommendations }: { recommendations: OpsRecommendation[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/30">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <Brain className="h-4 w-4 text-blue-200" />
        AI Operations Director
      </div>
      <div className="mt-4 space-y-3">
        {recommendations.map((rec) => (
          <RecommendationCard key={rec.title} recommendation={rec} />
        ))}
      </div>
      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
        Recommendations use geography, aggregate context, route density, timing, and cost only. No individual ideology,
        persuasion, or turnout prediction is created.
      </p>
    </section>
  );
}

function RecommendationCard({ recommendation }: { recommendation: OpsRecommendation }) {
  const tone =
    recommendation.tone === "green"
      ? "border-emerald-300/20 bg-emerald-500/10"
      : recommendation.tone === "gold"
        ? "border-amber-300/20 bg-amber-500/10"
        : recommendation.tone === "red"
          ? "border-red-300/20 bg-red-500/10"
          : "border-blue-300/20 bg-blue-500/10";

  return (
    <article className={`rounded-xl border p-3 ${tone}`}>
      <div className="text-sm font-black text-white">{recommendation.title}</div>
      <p className="mt-1 text-sm leading-5 text-slate-300">{recommendation.body}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">Why: {recommendation.reason}</p>
    </article>
  );
}

function LiveFeedPanel({ liveFeed }: { liveFeed: LiveFeedItem[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/30">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <Activity className="h-4 w-4 text-emerald-200" />
        Live Campaign Feed
      </div>
      <div className="mt-4 space-y-2">
        {liveFeed.map((item) => (
          <LiveFeedRow key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

function LiveFeedRow({ item }: { item: LiveFeedItem }) {
  const tone =
    item.tone === "green"
      ? "bg-emerald-300"
      : item.tone === "gold"
        ? "bg-amber-300"
        : item.tone === "red"
          ? "bg-red-300"
          : "bg-blue-300";

  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${tone}`} />
      <div>
        <div className="text-sm font-black text-white">{item.label}</div>
        <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
      </div>
    </div>
  );
}

function WhatIfSimulator({
  options,
  onApply,
}: {
  options: WhatIfOption[];
  onApply: (action: WhatIfAction) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-slate-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Zap className="h-4 w-4 text-amber-200" />
          What-if Simulator
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          Instant pricing preview
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
        {options.map((option) => (
          <article key={option.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-sm font-black text-white">{option.label}</div>
            <p className="mt-1 min-h-10 text-xs leading-5 text-slate-400">{option.detail}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-300">
              <div className="flex justify-between gap-3">
                <span>Pieces</span>
                <strong className="text-white">{formatNumber(option.printQuantity)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Households</span>
                <strong className="text-white">{option.householdDelta >= 0 ? "+" : ""}{formatNumber(option.householdDelta)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Total</span>
                <strong className="text-white">{formatCurrency(option.total)}</strong>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onApply(option.action)}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-blue-300/25 bg-blue-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-blue-100 transition hover:bg-blue-500/25"
            >
              Apply
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function WarRoomOverlay({
  stateKey,
  setStateKey,
  mode,
  mapData,
  selectedPoliticalUnitIds,
  selectedRouteSet,
  hoveredPolitical,
  hoveredRoute,
  activePoliticalLayers,
  activeUspsLayers,
  health,
  stats,
  timeline,
  recommendations,
  liveFeed,
  whatIfOptions,
  onPoliticalHover,
  onRouteHover,
  onPoliticalSelect,
  onRouteSelect,
  onReset,
  onClose,
  onApplyWhatIf,
}: {
  stateKey: StateKey;
  setStateKey: (key: StateKey) => void;
  mode: PoliticalMode;
  mapData: ReturnType<typeof buildMapData>;
  selectedPoliticalUnitIds: Set<string>;
  selectedRouteSet: Set<string>;
  hoveredPolitical: PoliticalUnit | null;
  hoveredRoute: RouteUnit | null;
  activePoliticalLayers: string[];
  activeUspsLayers: string[];
  health: CampaignHealth;
  stats: CampaignStats;
  timeline: TimelineItem[];
  recommendations: OpsRecommendation[];
  liveFeed: LiveFeedItem[];
  whatIfOptions: WhatIfOption[];
  onPoliticalHover: (id: string | null) => void;
  onRouteHover: (id: string | null) => void;
  onPoliticalSelect: (id: string) => void;
  onRouteSelect: (route: RouteUnit) => void;
  onReset: () => void;
  onClose: () => void;
  onApplyWhatIf: (action: WhatIfAction) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050b16] text-white">
      <div className="min-h-screen bg-[linear-gradient(135deg,#050b16_0%,#0B1F3A_46%,#111827_100%)]">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#071426]/95 px-5 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-red-200">
                Campaign War Room
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">
                {mapData.state.label} synchronized political + USPS operations
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TopMetric label="Health" value={`${health.score}/100`} />
              <TopMetric label="Households" value={formatNumber(stats.households)} />
              <TopMetric label="Estimate" value={formatCurrency(stats.total)} />
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
              >
                <Minimize2 className="h-4 w-4" />
                Exit War Room
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <SyncedMapController
            stateKey={stateKey}
            setStateKey={setStateKey}
            mode={mode}
            mapData={mapData}
            selectedPoliticalUnitIds={selectedPoliticalUnitIds}
            selectedRouteSet={selectedRouteSet}
            hoveredPolitical={hoveredPolitical}
            hoveredRoute={hoveredRoute}
            activePoliticalLayers={activePoliticalLayers}
            activeUspsLayers={activeUspsLayers}
            onPoliticalHover={onPoliticalHover}
            onRouteHover={onRouteHover}
            onPoliticalSelect={onPoliticalSelect}
            onRouteSelect={onRouteSelect}
            onReset={onReset}
          />
          <aside className="space-y-4">
            <CampaignHealthPanel health={health} />
            <AiDirectorPanel recommendations={recommendations} />
            <LiveFeedPanel liveFeed={liveFeed} />
          </aside>
        </div>
        <div className="grid gap-4 px-4 pb-4 xl:grid-cols-[0.9fr_1.4fr]">
          <TimelinePanel timeline={timeline} />
          <WhatIfSimulator options={whatIfOptions} onApply={onApplyWhatIf} />
        </div>
      </div>
    </div>
  );
}

function PoliticalMap({
  mode,
  mapData,
  mapView,
  selectedPoliticalUnitIds,
  selectedRouteSet,
  activePoliticalLayers,
  onViewChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onHover,
  onSelect,
}: {
  mode: PoliticalMode;
  mapData: ReturnType<typeof buildMapData>;
  mapView: MapViewState;
  selectedPoliticalUnitIds: Set<string>;
  selectedRouteSet: Set<string>;
  activePoliticalLayers: string[];
  onViewChange: (view: MapViewState) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const showPartisanLayer = activePoliticalLayers.some((layer) => layer.includes("Historical") || layer.includes("Party"));
  const hasSourcedPartisanColor = showPartisanLayer && Array.from(mapData.units.values()).some((unit) => unit.partisanDataReady);
  const hasOfficialDistrictLayer = mode === "district" && mapData.officialDistrictShapes.length > 0;
  const districtLayer = mapData.officialDistrictLayer;

  return (
    <MapContainer
      title="Political Campaign Map"
      subtitle={
        hasOfficialDistrictLayer
          ? `${districtLayer?.label ?? "Official district"} boundaries from ${districtLayer?.sourceName ?? "official GIS"}. Partisan colors stay neutral until district-level aggregates are imported.`
          : hasSourcedPartisanColor
            ? `${MODE_CONFIG[mode].label} layer colored from source-backed 2024 county presidential aggregates`
            : `${MODE_CONFIG[mode].label} layer with neutral coloring until this toggle has a validated partisan source`
      }
      badge={hasSourcedPartisanColor ? "2024 sourced" : hasOfficialDistrictLayer ? "Boundary only" : "Neutral"}
      icon={Flag}
      mapView={mapView}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onResetView={onResetView}
    >
      <InteractiveMapSvg
        ariaLabel={`${mapData.state.label} political campaign map`}
        className="bg-[#65686e]"
        view={mapView}
        onViewChange={onViewChange}
      >
        {({ shouldSuppressClick }) => (
          <>
            <path d={mapData.statePath} fill="#f8fafc" stroke="#ffffff" strokeWidth={5} />
            {hasOfficialDistrictLayer
              ? (
                  <>
                    {mapData.counties.map((row) => (
                      <path
                        key={row.countyId}
                        d={row.path}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={0.45}
                        opacity={0.42}
                        pointerEvents="none"
                      />
                    ))}
                    {mapData.officialDistrictShapes.map((district) => {
                      const unit = mapData.units.get(district.unitId);
                      const selected = selectedPoliticalUnitIds.has(district.unitId);
                      const synced = mapData.routes.some(
                        (route) => route.overlaps.district === district.unitId && selectedRouteSet.has(route.id),
                      );
                      const fill = unit
                        ? colorForPoliticalUnit(unit, selected || synced, showPartisanLayer)
                        : selected || synced
                          ? "#f59e0b"
                          : "#eef2f7";

                      return (
                        <g key={district.id}>
                          <path
                            d={district.path}
                            fill={fill}
                            stroke={selected || synced ? "#ffffff" : "#111827"}
                            strokeWidth={selected || synced ? 2.6 : 1.35}
                            opacity={selected || synced ? 0.98 : 0.92}
                            pointerEvents="all"
                            className="cursor-pointer transition hover:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (shouldSuppressClick()) return;
                              onSelect(district.unitId);
                            }}
                            onMouseEnter={() => onHover(district.unitId)}
                            onMouseLeave={() => onHover(null)}
                          >
                            <title>{`${district.label} - ${district.summary}. ${unit?.source ?? ""}`}</title>
                          </path>
                          <text
                            x={district.centroid[0]}
                            y={district.centroid[1]}
                            textAnchor="middle"
                            dominantBaseline="central"
                            paintOrder="stroke"
                            stroke="#0f172a"
                            strokeWidth={4}
                            fill="#ffffff"
                            fontSize={20}
                            fontWeight={900}
                            pointerEvents="none"
                          >
                            {district.district}
                          </text>
                        </g>
                      );
                    })}
                    <path
                      d={mapData.statePath}
                      fill="none"
                      stroke="#020617"
                      strokeWidth={2.6}
                      pointerEvents="none"
                    />
                  </>
                )
              : mapData.counties.map((row) => {
                  const unit = mapData.units.get(row.unitId);
                  const selected = selectedPoliticalUnitIds.has(row.unitId);
                  const synced = mapData.routes.some((route) => route.countyId === row.countyId && selectedRouteSet.has(route.id));
                  const fill = unit
                    ? colorForPoliticalUnit(unit, selected || synced, showPartisanLayer)
                    : selected || synced
                      ? "#f59e0b"
                      : "#eef2f7";

                  return (
                    <path
                      key={row.countyId}
                      d={row.path}
                      fill={fill}
                      stroke={selected || synced ? "#ffffff" : "#cbd5e1"}
                      strokeWidth={selected || synced ? 2 : 0.9}
                      opacity={selected || synced ? 0.96 : 0.9}
                      pointerEvents="all"
                      className="cursor-pointer transition hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (shouldSuppressClick()) return;
                        onSelect(row.unitId);
                      }}
                      onMouseEnter={() => onHover(row.unitId)}
                      onMouseLeave={() => onHover(null)}
                    >
                      <title>{unit ? `${unit.label}. ${unit.source}` : row.countyName}</title>
                    </path>
                  );
                })}
            {mode === "city" &&
              mapData.cityMarkers.map((marker) => {
                const unit = mapData.units.get(marker.unitId);
                const selected = selectedPoliticalUnitIds.has(marker.unitId);
                const showLabel = marker.priority <= 2 || mapView.scale >= 2;
                const markerFill = unit ? colorForPoliticalUnit(unit, selected, showPartisanLayer) : "#f8fafc";
                const [x, y] = marker.position;

                return (
                  <g
                    key={marker.id}
                    transform={`translate(${x},${y})`}
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (shouldSuppressClick()) return;
                      onSelect(marker.unitId);
                    }}
                    onMouseEnter={() => onHover(marker.unitId)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <circle
                      r={selected ? 8.5 : marker.priority === 1 ? 6.5 : 4.5}
                      fill={markerFill}
                      stroke={selected ? "#ffffff" : "#0f172a"}
                      strokeWidth={selected ? 2.8 : 1.6}
                      opacity={selected ? 1 : 0.96}
                    />
                    <circle
                      r={selected ? 13 : marker.priority === 1 ? 10 : 7.5}
                      fill="none"
                      stroke={selected ? "#fde68a" : "#ffffff"}
                      strokeWidth={selected ? 2.2 : 1.1}
                      opacity={selected ? 0.9 : 0.55}
                    />
                    {showLabel && (
                      <text
                        x={marker.priority === 1 ? 10 : 8}
                        y={marker.priority === 1 ? 4 : 3.5}
                        paintOrder="stroke"
                        stroke="#0f172a"
                        strokeWidth={marker.priority === 1 ? 4 : 3}
                        fill="#ffffff"
                        fontSize={marker.priority === 1 ? 18 : 13}
                        fontWeight={900}
                        letterSpacing={0}
                      >
                        {marker.label}
                      </text>
                    )}
                    <title>{`${marker.label} - ${marker.market}. ${unit?.source ?? "No source-backed partisan color loaded."}`}</title>
                  </g>
                );
              })}
          </>
        )}
      </InteractiveMapSvg>
      <MapLegend hasSourcedPartisanColor={hasSourcedPartisanColor} />
      {mode === "city" && (
        <CityCoverageIndex
          markers={mapData.cityMarkers}
          selectedPoliticalUnitIds={selectedPoliticalUnitIds}
          onSelect={onSelect}
        />
      )}
      {hasOfficialDistrictLayer && (
        <OfficialDistrictIndex
          layer={mapData.officialDistrictLayer}
          districts={mapData.officialDistrictShapes}
          selectedPoliticalUnitIds={selectedPoliticalUnitIds}
          onSelect={onSelect}
        />
      )}
    </MapContainer>
  );
}

function USPSMap({
  mode,
  mapData,
  mapView,
  selectedPoliticalUnitIds,
  selectedRouteSet,
  activeUspsLayers,
  onViewChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onHover,
  onSelect,
}: {
  mode: PoliticalMode;
  mapData: ReturnType<typeof buildMapData>;
  mapView: MapViewState;
  selectedPoliticalUnitIds: Set<string>;
  selectedRouteSet: Set<string>;
  activeUspsLayers: string[];
  onViewChange: (view: MapViewState) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onHover: (id: string | null) => void;
  onSelect: (route: RouteUnit) => void;
}) {
  const showRoutes = activeUspsLayers.includes("Carrier Route Overlay") || activeUspsLayers.includes("EDDM Route Overlay");

  return (
    <MapContainer
      title="USPS Mail Execution Map"
      subtitle="Demo carrier-route cells synchronized to political geography selection"
      badge="Demo, not USPS boundaries"
      icon={Mail}
      mapView={mapView}
      onZoomIn={onZoomIn}
      onZoomOut={onZoomOut}
      onResetView={onResetView}
    >
      <InteractiveMapSvg
        ariaLabel={`${mapData.state.label} USPS mail execution map`}
        className="bg-[#565b65]"
        view={mapView}
        onViewChange={onViewChange}
      >
        {({ shouldSuppressClick }) => (
          <>
            <path d={mapData.statePath} fill="#f1f5f9" stroke="#ffffff" strokeWidth={5} opacity={0.95} />
            {mapData.counties.map((row) => (
              <path key={row.countyId} d={row.path} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.8} opacity={0.42} />
            ))}
            {showRoutes &&
              mapData.routes.map((route) => {
                const selected = selectedRouteSet.has(route.id);
                const synced = selectedPoliticalUnitIds.has(route.overlaps[mode]);
                return (
                  <polygon
                    key={route.id}
                    points={route.polygon}
                    fill={selected ? "#f59e0b" : synced ? "#38bdf8" : "#e0f2fe"}
                    stroke={selected ? "#fff7ed" : synced ? "#bae6fd" : "#0f172a"}
                    strokeWidth={selected || synced ? 2.2 : 0.8}
                    opacity={selected || synced ? 0.96 : 0.78}
                    pointerEvents="all"
                    className="cursor-pointer transition hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (shouldSuppressClick()) return;
                      onSelect(route);
                    }}
                    onMouseEnter={() => onHover(route.id)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <title>{route.label}</title>
                  </polygon>
                );
              })}
          </>
        )}
      </InteractiveMapSvg>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold">
        <LegendChip color="#f59e0b" label="Selected demo cell" />
        <LegendChip color="#38bdf8" label="Synced demo cell" />
        <LegendChip color="#e0f2fe" label="Demo cell" />
      </div>
      <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100/85">
        <div className="flex items-center gap-2 font-black text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          Route geometry is demo/sample
        </div>
        <p className="mt-1">
          These cells are planning placeholders. Production mail counts must use USPS EDDM or licensed carrier-route
          polygons, deliverable address counts, and exclusions before quoting or checkout.
        </p>
      </div>
    </MapContainer>
  );
}

function MapContainer({
  title,
  subtitle,
  badge,
  icon: Icon,
  mapView,
  onZoomIn,
  onZoomOut,
  onResetView,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  icon: typeof MapIcon;
  mapView: MapViewState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-xl shadow-slate-950/30">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-blue-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
            {badge}
          </span>
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={onZoomOut}
              disabled={mapView.scale <= MIN_MAP_SCALE}
              aria-label={`Zoom out ${title}`}
              title="Zoom out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
              {Math.round(mapView.scale * 100)}%
            </span>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={mapView.scale >= MAX_MAP_SCALE}
              aria-label={`Zoom in ${title}`}
              title="Zoom in"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onResetView}
              aria-label={`Reset view ${title}`}
              title="Reset view"
              className="inline-flex h-8 items-center justify-center rounded-full px-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-200 transition hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function InteractiveMapSvg({
  ariaLabel,
  className,
  view,
  onViewChange,
  children,
}: {
  ariaLabel: string;
  className: string;
  view: MapViewState;
  onViewChange: (view: MapViewState) => void;
  children: (state: { shouldSuppressClick: () => boolean }) => React.ReactNode;
}) {
  const [drag, setDrag] = useState<MapDragState | null>(null);
  const suppressNextClick = useRef(false);
  const viewBox = `${view.x} ${view.y} ${VIEWBOX.width / view.scale} ${VIEWBOX.height / view.scale}`;

  function shouldSuppressClick() {
    if (!suppressNextClick.current) return false;
    suppressNextClick.current = false;
    return true;
  }

  function zoomFromWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor = {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
    const factor = event.deltaY > 0 ? 0.86 : 1.16;
    onViewChange(zoomMapViewAt(view, view.scale * factor, anchor));
  }

  function startDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startView: view,
    });
  }

  function moveDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const visibleWidth = VIEWBOX.width / drag.startView.scale;
    const visibleHeight = VIEWBOX.height / drag.startView.scale;
    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      suppressNextClick.current = true;
    }

    onViewChange(
      clampMapView({
        ...drag.startView,
        x: drag.startView.x - deltaX * (visibleWidth / Math.max(1, rect.width)),
        y: drag.startView.y - deltaY * (visibleHeight / Math.max(1, rect.height)),
      }),
    );
  }

  function endDrag(event: React.PointerEvent<SVGSVGElement>) {
    if (drag?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setDrag(null);
  }

  return (
    <svg
      aria-label={ariaLabel}
      className={`h-auto w-full touch-none select-none rounded-xl ${drag ? "cursor-grabbing" : "cursor-grab"} ${className}`}
      viewBox={viewBox}
      role="img"
      onWheel={zoomFromWheel}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={() => {
        if (suppressNextClick.current) {
          window.setTimeout(() => {
            suppressNextClick.current = false;
          }, 0);
        }
      }}
    >
      {children({ shouldSuppressClick })}
    </svg>
  );
}

function SelectionSummaryPanel({
  mode,
  dropCount,
  setDropCount,
  selectedRoutes,
  selectedUnits,
  stats,
  saveStatus,
  readiness,
  actionFeedback,
  proposalStatus,
  checkoutStatus,
  onSave,
  onProposal,
  onCheckout,
}: {
  mode: PoliticalMode;
  dropCount: number;
  setDropCount: (drops: number) => void;
  selectedRoutes: RouteUnit[];
  selectedUnits: PoliticalUnit[];
  stats: {
    households: number;
    deliveryPoints: number;
    coveragePct: number;
    printQuantity: number;
    printCost: number;
    postage: number;
    total: number;
    margin: number;
    confidence: DataLabel;
  };
  saveStatus: SaveStatus;
  readiness: PlanReadinessItem[];
  actionFeedback: ActionFeedback | null;
  proposalStatus: MapActionStatus;
  checkoutStatus: MapActionStatus;
  onSave: () => void | Promise<void>;
  onProposal: () => void | Promise<void>;
  onCheckout: () => void | Promise<void>;
}) {
  const saveLabel =
    saveStatus === "saving"
      ? "Saving plan snapshot"
      : saveStatus === "database"
        ? "Saved to database"
        : saveStatus === "local_only" || saveStatus === "error"
          ? "Saved locally"
          : "Save plan snapshot";

  return (
    <aside className="border-t border-white/10 bg-slate-950 p-4 lg:border-l lg:border-t-0">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-white/10 bg-blue-500/15 p-2 text-blue-200">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Selected Areas</p>
          <h3 className="text-lg font-black text-white">Plan summary</h3>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="Political units" value={formatNumber(selectedUnits.length)} />
        <Metric label="USPS routes" value={formatNumber(selectedRoutes.length)} />
        <Metric label="Households" value={formatNumber(stats.households)} />
        <Metric label="Delivery points" value={formatNumber(stats.deliveryPoints)} />
        <Metric label="Mail pieces" value={formatNumber(stats.printQuantity)} />
        <Metric label="Per postcard" value={formatPerPostcard(stats.total, stats.printQuantity)} />
        <Metric label="Coverage" value={`${stats.coveragePct}%`} />
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-black text-white">Mail drops</span>
          <div className="flex gap-2">
            {[1, 2, 3, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={dropCount === value}
                onClick={() => setDropCount(value)}
                className={`h-9 w-9 rounded-lg border text-sm font-black transition ${
                  dropCount === value
                    ? "border-blue-300 bg-blue-500 text-white"
                    : "border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <CostRow label="Print estimate" value={formatCurrency(stats.printCost)} />
        <CostRow label="Postage estimate" value={formatCurrency(stats.postage)} />
        <CostRow label="Total estimate" value={formatCurrency(stats.total)} strong />
        <CostRow label="Estimate status" value={stats.confidence === "Demo/Sample" ? "Preview only" : stats.confidence} muted />
      </div>

      <DataConfidenceBadge label={stats.confidence} className="mt-4" />

      <ReadinessChecklist items={readiness} />

      {actionFeedback && <ActionFeedbackPanel feedback={actionFeedback} />}

      <div className="mt-4 space-y-2">
        <ActionButton icon={Save} label={saveLabel} onClick={onSave} full />
        <ActionButton
          icon={FileText}
          label={proposalStatus === "working" ? "Checking proposal" : "Send to proposal"}
          state={proposalStatus === "working" ? "loading" : proposalStatus}
          disabledReason={actionBlockers(readiness, "proposal").length > 0 ? "Complete the checklist before proposal handoff." : undefined}
          onClick={onProposal}
          full
        />
        <ActionButton
          icon={CreditCard}
          label={checkoutStatus === "working" ? "Checking checkout" : "Create checkout"}
          state={checkoutStatus === "working" ? "loading" : checkoutStatus}
          disabledReason={actionBlockers(readiness, "checkout").length > 0 ? "Checkout is blocked until the quote is verified." : undefined}
          onClick={onCheckout}
          full
        />
      </div>

      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
        <div className="flex items-center gap-2 font-black">
          <AlertTriangle className="h-4 w-4" />
          Missing data warning
        </div>
        <p className="mt-2 text-xs text-amber-100/80">
          {MODE_CONFIG[mode].label} selections are synced to demo USPS route cells until authoritative carrier-route
          polygons, live delivery counts, and postal exclusions are imported.
        </p>
      </div>
      <div className="mt-4 rounded-xl border border-blue-300/20 bg-blue-500/10 p-4 text-xs leading-5 text-blue-50">
        <div className="font-black uppercase tracking-[0.16em]">Plain-English terms</div>
        <p className="mt-2">
          Households are estimated residential mail targets. Delivery points are mail delivery stops. Mail pieces equal
          households multiplied by drops. Coverage is the share of loaded geography reached by selected route cells.
        </p>
      </div>
    </aside>
  );
}

function ReadinessChecklist({ items }: { items: PlanReadinessItem[] }) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black text-white">What do I do next?</div>
        <span className="rounded-full border border-white/10 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
          {readinessProgress(items)} ready
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-2 rounded-lg border border-white/10 bg-slate-950/70 p-2">
            {item.complete ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            )}
            <div>
              <div className="text-xs font-black text-white">{item.label}</div>
              <div className="mt-0.5 text-[11px] leading-4 text-slate-400">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionFeedbackPanel({ feedback }: { feedback: ActionFeedback }) {
  const tone =
    feedback.tone === "success"
      ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-50"
      : feedback.tone === "error"
        ? "border-red-300/25 bg-red-500/10 text-red-50"
        : "border-amber-300/25 bg-amber-500/10 text-amber-50";

  return (
    <div className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${tone}`}>
      <div className="font-black">{feedback.title}</div>
      <p className="mt-1 text-xs leading-5 opacity-85">{feedback.body}</p>
      {feedback.checklist && feedback.checklist.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {feedback.checklist.map((item) => (
            <div key={item.id} className="rounded-md border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs">
              {item.label}
            </div>
          ))}
        </div>
      )}
      {feedback.href && feedback.hrefLabel && (
        <a
          href={feedback.href}
          className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-slate-100"
        >
          {feedback.hrefLabel}
        </a>
      )}
    </div>
  );
}

function CampaignPlanDrawer({
  selectedRoutes,
  stats,
  confidence,
  readiness,
  actionFeedback,
  exportStatus,
  onExportCsv,
  onExportSummary,
}: {
  selectedRoutes: RouteUnit[];
  stats: { households: number; deliveryPoints: number; printQuantity: number; total: number };
  confidence: DataLabel;
  readiness: PlanReadinessItem[];
  actionFeedback: ActionFeedback | null;
  exportStatus: MapActionStatus;
  onExportCsv: () => void;
  onExportSummary: () => void;
}) {
  return (
    <footer className="border-t border-white/10 bg-slate-950 p-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <DataSourcePanel confidence={confidence} />
        <MissingDataPanel />
        <ProposalActionPanel
          selectedRoutes={selectedRoutes}
          stats={stats}
          readiness={readiness}
          actionFeedback={actionFeedback}
          exportStatus={exportStatus}
          onExportCsv={onExportCsv}
          onExportSummary={onExportSummary}
        />
      </div>
    </footer>
  );
}

function DataSourcePanel({ confidence }: { confidence: DataLabel }) {
  const sourceLinks = [
    { label: "Ohio SOS districts", href: OHIO_SOS_DISTRICT_MAPS_URL },
    { label: "Illinois boundaries", href: ILLINOIS_BOUNDARIES_URL },
    { label: "Tennessee TNMap", href: TENNESSEE_COMPTROLLER_REDISTRICTING_URL },
    { label: "Census TIGER/Line", href: CENSUS_TIGER_URL },
    { label: "Census TIGERweb", href: CENSUS_TIGER_REST_URL },
    { label: "Ohio GIS boundaries", href: OHIO_MUNICIPAL_BOUNDARIES_URL },
    { label: "USPS EDDM", href: USPS_EDDM_URL },
  ];

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <ShieldCheck className="h-4 w-4 text-emerald-200" />
        Data sources and methodology
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        County boundaries are public aggregate geometry. Ohio county red/blue/mixed coloring uses 2024 presidential
        county returns and is only shown on source-backed county mode. City, ZIP, district, and USPS route toggles stay
        neutral until matching aggregate election results are imported for that exact geography.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Public Aggregate", "Estimated", "Demo/Sample", confidence].map((label, index) => (
          <DataConfidenceBadge key={`${label}-${index}`} label={label as DataLabel} compact />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sourceLinks.map((source) => (
          <a
            key={source.label}
            href={source.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-blue-300/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20"
          >
            {source.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </section>
  );
}

function MissingDataPanel() {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <AlertTriangle className="h-4 w-4 text-amber-200" />
        API and source requirements
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
        <li>Refresh Ohio, Illinois, and Tennessee district layers on a scheduled source-check cadence.</li>
        <li>Import Ohio municipal, township, and school district FeatureServer layers.</li>
        <li>Load Census tract, block group, place, and ZCTA geometry.</li>
        <li>Verify USPS EDDM or licensed carrier-route polygons before production pricing.</li>
        <li>Use county BOE precinct/ward files with source lineage and compliance review.</li>
      </ul>
    </section>
  );
}

function ProposalActionPanel({
  selectedRoutes,
  stats,
  readiness,
  actionFeedback,
  exportStatus,
  onExportCsv,
  onExportSummary,
}: {
  selectedRoutes: RouteUnit[];
  stats: { households: number; deliveryPoints: number; printQuantity: number; total: number };
  readiness: PlanReadinessItem[];
  actionFeedback: ActionFeedback | null;
  exportStatus: MapActionStatus;
  onExportCsv: () => void;
  onExportSummary: () => void;
}) {
  const ready = selectedRoutes.length > 0;
  const checkoutBlockers = actionBlockers(readiness, "checkout").length;
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-white">
        <CheckCircle2 className="h-4 w-4 text-blue-200" />
        Recommended next action
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {ready
          ? `Package ${formatNumber(stats.printQuantity)} pieces into a proposal and verify live USPS counts before checkout.`
          : "Select political geography or USPS routes to stage a campaign map plan."}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Checkout blockers: {checkoutBlockers}. Demo/sample route cells are planning previews only.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ActionButton
          icon={FileDown}
          label={exportStatus === "working" ? "Exporting CSV" : "Export CSV"}
          state={exportStatus === "working" ? "loading" : exportStatus}
          onClick={onExportCsv}
        />
        <ActionButton
          icon={FileText}
          label="Export summary"
          state={exportStatus}
          onClick={onExportSummary}
        />
      </div>
      {actionFeedback && (
        <p className="mt-3 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-400">
          Last action: {actionFeedback.title}
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function CostRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={muted ? "text-slate-500" : "text-slate-300"}>{label}</span>
      <span className={strong ? "text-lg font-black text-white" : muted ? "font-bold text-slate-500" : "font-bold text-slate-100"}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  full,
  state = "idle",
  disabledReason,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void | Promise<void>;
  full?: boolean;
  state?: MapActionStatus | "loading";
  disabledReason?: string;
}) {
  const isLoading = state === "loading" || state === "working";
  const isDisabled = isLoading || !onClick;
  const stateTone =
    state === "success"
      ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-50"
      : state === "error"
        ? "border-amber-300/35 bg-amber-500/15 text-amber-50"
        : disabledReason
          ? "border-white/10 bg-white/[0.03] text-slate-300"
          : "border-white/15 bg-white/5 text-white";

  return (
    <button
      type="button"
      onClick={() => {
        if (isDisabled) return;
        void onClick?.();
      }}
      aria-disabled={Boolean(disabledReason) || isDisabled}
      disabled={isDisabled}
      title={disabledReason}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition hover:bg-white/10 ${
        disabledReason ? "opacity-80" : ""
      } ${stateTone} ${full ? "w-full" : ""}`}
    >
      <Icon className={`h-4 w-4 ${isLoading ? "animate-pulse" : ""}`} />
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {disabledReason && (
          <span className="block truncate text-[10px] font-semibold opacity-75">
            Needs checklist
          </span>
        )}
      </span>
    </button>
  );
}

function HoverCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{detail}</div>
    </div>
  );
}

function MapLegend({ hasSourcedPartisanColor }: { hasSourcedPartisanColor: boolean }) {
  return (
    <div className="mt-3 grid gap-2 text-xs font-bold sm:grid-cols-3">
      {hasSourcedPartisanColor ? (
        <>
          <LegendChip color="#2563eb" label="Blue: Democratic aggregate advantage" />
          <LegendChip color="#dc2626" label="Red: Republican aggregate advantage" />
          <LegendChip color="#64748b" label="Gray: margin under 5 pts or unavailable" />
        </>
      ) : (
        <>
          <LegendChip color="#e5e7eb" label="Neutral: source not loaded for this toggle" />
          <LegendChip color="#f59e0b" label="Selected geography" />
          <LegendChip color="#64748b" label="No partisan inference shown" />
        </>
      )}
    </div>
  );
}

function OfficialDistrictIndex({
  layer,
  districts,
  selectedPoliticalUnitIds,
  onSelect,
}: {
  layer: OfficialDistrictLayerInfo | null;
  districts: OfficialDistrictShape[];
  selectedPoliticalUnitIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-blue-300/20 bg-blue-500/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
            {layer?.label ?? "Official Districts"}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Official district polygons are loaded for this state/layer. Click a district to sync demo route cells.
          </p>
        </div>
        <a
          href={layer?.sourceUrl ?? "/political/data-sources"}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-blue-200/25 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-100 transition hover:bg-blue-950"
        >
          Source
        </a>
      </div>
      <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {districts.map((district) => {
          const selected = selectedPoliticalUnitIds.has(district.unitId);

          return (
            <button
              key={district.id}
              type="button"
              onClick={() => onSelect(district.unitId)}
              className={`rounded-lg border p-2 text-left transition ${
                selected
                  ? "border-amber-200 bg-amber-300 text-slate-950"
                  : "border-white/10 bg-slate-950/80 text-slate-200 hover:bg-white/10"
              }`}
            >
              <span className="block text-xs font-black uppercase tracking-[0.12em]">
                District {district.district}
              </span>
              <span className={`mt-1 block text-xs leading-5 ${selected ? "text-slate-800" : "text-slate-400"}`}>
                {district.summary}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CityCoverageIndex({
  markers,
  selectedPoliticalUnitIds,
  onSelect,
}: {
  markers: CityMarker[];
  selectedPoliticalUnitIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const priorityMarkers = markers
    .filter((marker) => marker.priority <= 2)
    .sort((a, b) => a.label.localeCompare(b.label));
  const secondaryMarkers = markers
    .filter((marker) => marker.priority === 3)
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
            City Coverage Index
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            City markers are selectable and sync to USPS route clusters.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
          {markers.length} cities
        </span>
      </div>
      <div className="mt-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {[...priorityMarkers, ...secondaryMarkers].map((marker) => {
          const selected = selectedPoliticalUnitIds.has(marker.unitId);

          return (
            <button
              key={marker.id}
              type="button"
              onClick={() => onSelect(marker.unitId)}
              title={`${marker.label} maps into ${marker.market}`}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                selected
                  ? "border-amber-200 bg-amber-300 text-slate-950"
                  : marker.priority === 1
                    ? "border-blue-300/35 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25"
                    : "border-white/10 bg-slate-950/70 text-slate-300 hover:bg-white/10"
              }`}
            >
              {marker.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function DataConfidenceBadge({
  label,
  compact,
  className = "",
}: {
  label: DataLabel;
  compact?: boolean;
  className?: string;
}) {
  const tone =
    label === "Exact"
      ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
      : label === "Unavailable"
        ? "border-red-300/30 bg-red-500/10 text-red-100"
        : label === "Demo/Sample"
          ? "border-amber-300/30 bg-amber-500/10 text-amber-100"
          : "border-blue-300/30 bg-blue-500/10 text-blue-100";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${tone} ${className}`}>
      {!compact && <Database className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
