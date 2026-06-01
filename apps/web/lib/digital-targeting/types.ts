export type DigitalCampaignRecord = {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
  business_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  objective?: string | null;
  targeting_type?: string | null;
  monthly_management_fee?: number | null;
  monthly_ad_spend?: number | null;
  setup_fee?: number | null;
  payment_status?: string | null;
  campaign_status?: string | null;
  start_date?: string | null;
  landing_page_url?: string | null;
  tracking_url?: string | null;
  direct_mail_addon?: boolean | null;
  creative_package_addon?: boolean | null;
  landing_page_needed?: boolean | null;
  ad_spend_confirmed?: boolean | null;
  creative_approved?: boolean | null;
  admin_approved_for_launch?: boolean | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DigitalTargetLocationRecord = {
  id: string;
  campaign_id: string;
  location_type?: string | null;
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_miles?: number | null;
  notes?: string | null;
};

export type DigitalCampaignAssetRecord = {
  id: string;
  campaign_id: string;
  asset_type?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  status?: string | null;
  notes?: string | null;
};

export type DigitalCampaignTaskRecord = {
  id: string;
  campaign_id: string;
  title?: string | null;
  status?: string | null;
  owner?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
};

export type DigitalCampaignMetricRecord = {
  id: string;
  campaign_id: string;
  reporting_period_start?: string | null;
  reporting_period_end?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  spend?: number | null;
  leads?: number | null;
  calls?: number | null;
  landing_page_visits?: number | null;
  qr_scans?: number | null;
  notes?: string | null;
};

export type DigitalCampaignDraftRecord = {
  id: string;
  campaign_id: string;
  draft_type?: string | null;
  content?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};
