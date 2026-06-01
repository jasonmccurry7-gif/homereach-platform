export type DailyVideoVertical = "procurement" | "targeted_postcard" | "political";

export type DailyVideoStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "needs_revision";

export type DailyVideoPlatform =
  | "facebook_reels"
  | "instagram_reels"
  | "tiktok"
  | "linkedin"
  | "youtube_shorts";

export type StoryboardScene = {
  time: string;
  visual: string;
  caption: string;
  motion: string;
  voiceover: string;
};

export type DailyVideoDraft = {
  contentDate: string;
  vertical: DailyVideoVertical;
  title: string;
  angle: string;
  videoHook: string;
  fullScript: string;
  voiceoverScript: string;
  primaryCta: string;
  emotionalTone: string;
  storyboard: StoryboardScene[];
  canvaPrompt: string;
  canvaFields: Record<string, string | number | boolean | null>;
  captions: string[];
  alternateHooks: string[];
  dashboardScreenshots: string[];
  thumbnailConcept: string;
  platformPosts: Record<DailyVideoPlatform, string>;
  hashtags: string[];
  suggestedMusicVibe: string;
  aiImagePrompts: string[];
  motionGraphics: string[];
  cameraMovements: string[];
  transitionInstructions: string[];
  emotionalGuidance: string;
  repurposedAssets: RepurposedContentAsset[];
  suggestedPostingTimes: Record<DailyVideoPlatform, string>;
  engagementStrategy: string[];
  logoOutroSpec: LogoOutroSpec;
  manualPublishChecklist: string[];
  optimizationNotes: string[];
  sourceContext: Record<string, unknown>;
};

export type RepurposedContentAsset = {
  channel:
    | "facebook_post"
    | "facebook_group_post"
    | "email"
    | "sms"
    | "dm"
    | "ad_concept"
    | "short_form_video_script"
    | "landing_page_section";
  label: string;
  copy: string;
  recommendedUse: string;
  approvalRequired: boolean;
  humanAction: string;
};

export type DailyContentContextSignal = {
  id: string;
  source: "content_intel" | "ai_output" | "performance_pattern";
  title: string;
  category: string;
  summary: string;
  score?: number | null;
  createdAt?: string | null;
};

export type DailyContentGenerationContext = {
  loadedAt: string;
  contentIntel: DailyContentContextSignal[];
  aiOutputs: DailyContentContextSignal[];
  performanceSignals: DailyContentContextSignal[];
};

export type LogoOutroSpec = {
  name: string;
  durationSeconds: number;
  format: "vertical_9_16";
  visualStyle: string;
  animation: string[];
  finalFrame: string[];
  ctaVariations: string[];
  audio: string[];
  guardrails: string[];
};

export type DailyVideoContentRow = {
  id: string;
  content_date: string;
  vertical: DailyVideoVertical;
  title: string;
  angle: string;
  video_hook: string;
  full_script: string;
  voiceover_script: string;
  primary_cta: string;
  emotional_tone: string;
  status: DailyVideoStatus;
  approval_status: "pending" | "approved" | "rejected" | "needs_revision";
  storyboard: StoryboardScene[];
  canva_prompt: string;
  canva_fields: Record<string, unknown>;
  canva_job: Record<string, unknown>;
  captions: string[];
  alternate_hooks: string[];
  dashboard_screenshots: string[];
  thumbnail_concept: string;
  platform_posts: Record<DailyVideoPlatform, string>;
  hashtags: string[];
  suggested_music_vibe: string;
  ai_image_prompts: string[];
  motion_graphics: string[];
  camera_movements: string[];
  transition_instructions: string[];
  emotional_guidance: string;
  suggested_posting_times: Record<DailyVideoPlatform, string>;
  engagement_strategy: string[];
  logo_outro_spec: LogoOutroSpec;
  manual_publish_checklist: string[];
  scheduled_at: string | null;
  published_at: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  optimization_notes: string[];
  source_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DailyVideoPlatformPostRow = {
  id: string;
  video_id: string;
  platform: DailyVideoPlatform;
  status: "draft" | "awaiting_approval" | "approved" | "scheduled" | "published" | "manual_publish_ready" | "failed";
  caption: string;
  hashtags: string[];
  thumbnail_concept: string;
  recommended_posting_time: string;
  checklist: string[];
  external_post_id: string | null;
  external_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
