// ─────────────────────────────────────────────────────────────────────────────
// Ad Engine — Business Category Templates
// Copy + color palettes tuned for conversion by industry vertical.
// ─────────────────────────────────────────────────────────────────────────────

import type { CategoryTemplate, ColorPalette } from "../types";

// ── Palette Helpers ───────────────────────────────────────────────────────────

function palette(
  primary: string, secondary: string, accent: string, imageBg: string,
  primaryText = "#FFFFFF", secondaryText = "#FFFFFF", accentText = "#FFFFFF", muted = "#B0B8C8"
): ColorPalette {
  return { primary, primaryText, secondary, secondaryText, accent, accentText, imageBg, muted };
}

// ── Category Template Registry ────────────────────────────────────────────────

export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {

  // ── Roofing ─────────────────────────────────────────────────────────────────
  roofing: {
    key: "roofing", label: "Roofing", icon: "🏠",
    imageIdeal: "Crew working on roof, before/after damage photo, or home exterior",
    palette: palette("#1B2C5E", "#D83A2B", "#E8A020", "#0F1E44"),
    headlines:       ["Roof Leak? We Fix It Fast.", "Don't Let Roof Damage Get Worse.", "Local Roofers You Can Trust"],
    anchorHeadlines: ["Storm Damage? Get a Free Inspection Today.", "Protect Your Home Before the Next Storm Hits.", "The Roofing Company Your Neighbors Trust"],
    subheadlines:    ["Licensed & insured. 5-star rated.", "Expert repairs, replacements & inspections."],
    offers:          ["Free Roof Inspection", "No-Cost Damage Assessment", "10% Off Full Roof Replacement"],
    ctas:            ["Call for Free Estimate", "Book Inspection Now", "Get a Free Quote"],
    taglines:        ["Protecting Northeast Ohio Homes Since 2005", "Your Local Roofing Experts"],
    badges:          ["FREE INSPECTION", "LIMITED TIME", "STORM SPECIAL"],
  },

  // ── HVAC ────────────────────────────────────────────────────────────────────
  hvac: {
    key: "hvac", label: "HVAC", icon: "❄️",
    imageIdeal: "Technician working on unit, comfortable family at home, or modern HVAC system",
    palette: palette("#0F3460", "#E94F37", "#00A3CC", "#081F3B"),
    headlines:       ["AC Down? We'll Be There Today.", "Stay Comfortable All Year Long.", "Heating & Cooling Done Right"],
    anchorHeadlines: ["Beat the Heat — AC Tune-Up Starting at $89.", "Same-Day HVAC Service for Your Home.", "When Comfort Matters, Call Us First."],
    subheadlines:    ["Fast, reliable service. Local technicians.", "Serving your neighborhood for over 15 years."],
    offers:          ["$89 AC Tune-Up Special", "Free System Evaluation", "Same-Day Service Available"],
    ctas:            ["Schedule Service Now", "Call for Same-Day Help", "Book Your Tune-Up"],
    taglines:        ["Your Comfort Is Our Priority", "24/7 Emergency Service"],
    badges:          ["SAME-DAY", "$89 TUNE-UP", "24/7 SERVICE"],
  },

  // ── Plumbing ─────────────────────────────────────────────────────────────────
  plumbing: {
    key: "plumbing", label: "Plumbing", icon: "🔧",
    imageIdeal: "Plumber working under sink, clean pipes, or happy homeowner",
    palette: palette("#1565C0", "#FF6F00", "#1E88E5", "#0D47A1"),
    headlines:       ["Leaking? We Fix It Fast.", "Plumbing Problems? Call Now.", "No Job Too Big or Too Small"],
    anchorHeadlines: ["Emergency Plumbing Service — Available 24/7.", "From Leaks to Full Installations, We Do It All.", "Fast, Honest Plumbing. No Surprise Fees."],
    subheadlines:    ["Upfront pricing. No hidden fees.", "Licensed master plumbers in your area."],
    offers:          ["$50 Off Any Service Call", "Free Drain Inspection", "No Service Fee with Repair"],
    ctas:            ["Call Now — We're Ready", "Schedule a Repair", "Get a Free Estimate"],
    taglines:        ["Licensed. Insured. Trusted.", "Northeast Ohio's #1 Plumber"],
    badges:          ["24/7 EMERGENCY", "$50 OFF", "FREE ESTIMATE"],
  },

  // ── Dental ──────────────────────────────────────────────────────────────────
  dental: {
    key: "dental", label: "Dental", icon: "🦷",
    imageIdeal: "Bright smile, dental chair, or welcoming office interior",
    palette: palette("#0277BD", "#00ACC1", "#0288D1", "#01579B"),
    headlines:       ["Your Smile Deserves the Best.", "New Patients Welcome!", "Clean, Bright, Healthy Smiles"],
    anchorHeadlines: ["Accepting New Patients — Your First Visit Is on Us.", "Modern Dental Care for the Whole Family.", "Comfortable Dentistry You'll Actually Look Forward To."],
    subheadlines:    ["Family dentistry, cosmetic & emergency care.", "Most insurance accepted. New patients always welcome."],
    offers:          ["Free New Patient Exam", "$99 Cleaning + X-Rays", "Complimentary Whitening with New Patient Exam"],
    ctas:            ["Book Your Appointment", "Call to Schedule Today", "Claim Your Free Exam"],
    taglines:        ["Serving Families in Your Neighborhood", "Where Comfort Meets Care"],
    badges:          ["NEW PATIENTS", "FREE EXAM", "ACCEPTING INSURANCE"],
  },

  // ── Real Estate ──────────────────────────────────────────────────────────────
  real_estate: {
    key: "real_estate", label: "Real Estate", icon: "🏡",
    imageIdeal: "Beautiful home exterior, sold sign, or agent headshot with home",
    palette: palette("#1A4731", "#C9A84C", "#2E7D32", "#0F2D1E"),
    headlines:       ["Ready to Sell? Get Top Dollar.", "Find Your Dream Home This Season.", "Local Expert. Real Results."],
    anchorHeadlines: ["Thinking of Selling? Your Home May Be Worth More Than You Think.", "Buying or Selling — Work With a Local Expert Who Knows This Market.", "Homes Are Selling Fast. Let's Get You Moving."],
    subheadlines:    ["Local market expertise. Proven results.", "Top-rated agent serving your neighborhood."],
    offers:          ["Free Home Valuation", "No-Obligation Market Analysis", "Complimentary Selling Strategy Session"],
    ctas:            ["Get Your Free Home Value", "Let's Talk Today", "Schedule a Free Consultation"],
    taglines:        ["Trusted by Hundreds of Homeowners", "Your Neighborhood Expert"],
    badges:          ["FREE VALUATION", "LOCAL EXPERT", "TOP RATED"],
  },

  // ── Med Spa ──────────────────────────────────────────────────────────────────
  medspa: {
    key: "medspa", label: "Med Spa", icon: "💆",
    imageIdeal: "Elegant spa interior, glowing skin close-up, or aesthetic treatment photo",
    palette: palette("#2C2C2C", "#B08D57", "#C8A882", "#1A1A1A"),
    headlines:       ["Look Your Best. Feel Confident.", "Glow All Year Long.", "Expert Aesthetic Treatments"],
    anchorHeadlines: ["Refresh Your Look With Expert Aesthetic Treatments.", "Look & Feel Your Best — Book Your Consultation Today.", "Your Confidence Starts Here. Let's Talk."],
    subheadlines:    ["Botox, fillers, facials & more.", "Medical-grade results in a spa-like setting."],
    offers:          ["20% Off First Treatment", "Free Skin Consultation", "Complimentary Botox Consultation"],
    ctas:            ["Book Your Consultation", "Claim Your Offer Now", "Schedule a Free Consult"],
    taglines:        ["Beauty. Confidence. Results.", "Where You Come to Glow"],
    badges:          ["20% OFF", "FREE CONSULT", "NEW CLIENTS"],
  },

  // ── Landscaping ──────────────────────────────────────────────────────────────
  landscaping: {
    key: "landscaping", label: "Landscaping", icon: "🌿",
    imageIdeal: "Manicured lawn, landscaping crew, or stunning yard transformation",
    palette: palette("#2E7D32", "#795548", "#43A047", "#1B5E20"),
    headlines:       ["Your Dream Yard Is One Call Away.", "We Make Lawns Look Amazing.", "Curb Appeal That Gets Noticed"],
    anchorHeadlines: ["Transform Your Yard This Season — Free Estimate Included.", "Expert Landscaping for Northeast Ohio Homes.", "The Lawn You've Always Wanted Starts Here."],
    subheadlines:    ["Mowing, mulching, cleanups & more.", "Reliable, affordable, beautiful results."],
    offers:          ["Free Landscaping Estimate", "First Mow Free", "Spring Cleanup Special"],
    ctas:            ["Get a Free Estimate", "Call to Schedule", "Book Your Cleanup"],
    taglines:        ["Locally Owned. Beautifully Maintained.", "Your Yard, Our Passion"],
    badges:          ["FREE ESTIMATE", "SPRING SPECIAL", "FIRST MOW FREE"],
  },

  // ── Cleaning ─────────────────────────────────────────────────────────────────
  cleaning: {
    key: "cleaning", label: "Cleaning Services", icon: "🧹",
    imageIdeal: "Gleaming clean kitchen, professional cleaner, or sparkling home interior",
    palette: palette("#00695C", "#00ACC1", "#00796B", "#004D40"),
    headlines:       ["A Clean Home Is a Happy Home.", "Professional Cleaning You Can Trust.", "Spotless Results, Every Time"],
    anchorHeadlines: ["Give Yourself the Gift of a Spotlessly Clean Home.", "Professional Home Cleaning — Satisfaction Guaranteed.", "Trusted Cleaners in Your Neighborhood."],
    subheadlines:    ["Background-checked, insured, and reliable.", "Weekly, bi-weekly, or one-time deep cleans."],
    offers:          ["First Clean 15% Off", "Free Deep Clean Estimate", "$25 Off Your First Booking"],
    ctas:            ["Book a Clean Today", "Get a Free Quote", "Claim Your Discount"],
    taglines:        ["Trusted. Insured. Spotless.", "Your Clean Home Awaits"],
    badges:          ["15% OFF", "INSURED & BONDED", "FREE QUOTE"],
  },

  // ── Chiropractic ─────────────────────────────────────────────────────────────
  chiropractic: {
    key: "chiropractic", label: "Chiropractic", icon: "🩺",
    imageIdeal: "Chiropractor with patient, spine graphic, or relieved patient smiling",
    palette: palette("#4A148C", "#00796B", "#6A1B9A", "#2D0060"),
    headlines:       ["Pain Relief Starts Here.", "Live Pain-Free. Live Better.", "Back Pain? We Can Help."],
    anchorHeadlines: ["Stop Living With Pain — Expert Chiropractic Care Awaits.", "Neck Pain, Back Pain, Headaches — We Treat the Root Cause.", "New Patients Welcome. Real Relief. Real Results."],
    subheadlines:    ["New patients welcome. Same-week appointments.", "Natural pain relief without surgery or drugs."],
    offers:          ["New Patient Special — $49 Exam & X-Ray", "Free Consultation for New Patients", "$99 New Patient Package"],
    ctas:            ["Book Your Appointment", "Claim New Patient Offer", "Call for Same-Week Appt"],
    taglines:        ["Your Path to a Pain-Free Life", "Natural. Effective. Life-Changing."],
    badges:          ["NEW PATIENTS", "$49 SPECIAL", "FREE CONSULT"],
  },

  // ── Insurance ─────────────────────────────────────────────────────────────────
  insurance: {
    key: "insurance", label: "Insurance", icon: "🛡️",
    imageIdeal: "Family at home, handshake, or professional agent portrait",
    palette: palette("#0D47A1", "#388E3C", "#1565C0", "#082A6B"),
    headlines:       ["Are You Fully Protected?", "Better Coverage. Lower Rates.", "Local Agent. Real Protection."],
    anchorHeadlines: ["Switch to Better Coverage — Compare Rates in Minutes.", "Protect What Matters Most With the Right Insurance.", "Local Agent, Personal Service, Better Rates."],
    subheadlines:    ["Home, auto, life & business coverage.", "Independent agent — we shop rates for you."],
    offers:          ["Free Coverage Review", "Compare Rates in 5 Minutes", "No-Obligation Policy Analysis"],
    ctas:            ["Get a Free Quote", "Schedule a Review", "Call to Save Today"],
    taglines:        ["Protecting Your Family & Your Future", "Local Agent. Personal Service."],
    badges:          ["FREE QUOTE", "SAVE TODAY", "LOCAL AGENT"],
  },

  // ── Auto Repair ──────────────────────────────────────────────────────────────
  auto_repair: {
    key: "auto_repair", label: "Auto Repair", icon: "🚗",
    imageIdeal: "Mechanic working on car, clean shop interior, or satisfied customer",
    palette: palette("#263238", "#C62828", "#37474F", "#161E22"),
    headlines:       ["Car Trouble? We Fix It Right.", "Honest Auto Repair. Fair Prices.", "Your Car Deserves the Best"],
    anchorHeadlines: ["Stop Overpaying for Auto Repairs. Get an Honest Estimate Today.", "Fast, Reliable Auto Service — Most Cars Done Same Day.", "Trust Your Car to the Mechanics Your Neighbors Recommend."],
    subheadlines:    ["ASE-certified mechanics. Warranty on all work.", "No surprises. Honest diagnostics. Fair pricing."],
    offers:          ["Free Multi-Point Inspection", "$20 Off Any Repair Over $100", "Free Oil Change with Major Service"],
    ctas:            ["Schedule Your Service", "Call for a Free Estimate", "Book Online Today"],
    taglines:        ["Honest. Fast. Reliable.", "The Shop Your Neighbors Trust"],
    badges:          ["FREE INSPECTION", "$20 OFF", "SAME DAY"],
  },

  // ── Fitness / Gym ─────────────────────────────────────────────────────────────
  fitness: {
    key: "fitness", label: "Fitness / Gym", icon: "💪",
    imageIdeal: "Modern gym interior, people working out, or fitness transformation",
    palette: palette("#1A237E", "#F57F17", "#283593", "#0D1257"),
    headlines:       ["Your Fitness Goals Start Here.", "Get Fit. Feel Amazing.", "Train Hard. Live Strong."],
    anchorHeadlines: ["Join a Gym Where Members Actually Get Results.", "No Contracts. No Excuses. Just Results.", "Transform Your Body in 30 Days — We'll Show You How."],
    subheadlines:    ["Personal training, group classes & open gym.", "First week free for new members."],
    offers:          ["First Month Free", "Free Personal Training Session", "No Enrollment Fee This Month"],
    ctas:            ["Claim Your Free Week", "Start Your Free Trial", "Join Today"],
    taglines:        ["Where Goals Become Reality", "Built for Results"],
    badges:          ["FIRST MONTH FREE", "NO CONTRACTS", "FREE TRIAL"],
  },

  // ── Restaurant / Food ────────────────────────────────────────────────────────
  restaurant: {
    key: "restaurant", label: "Restaurant", icon: "🍽️",
    imageIdeal: "Signature dish close-up, inviting dining room, or chef at work",
    palette: palette("#7B1F1F", "#D4AF37", "#9C2727", "#521212"),
    headlines:       ["Fresh Ingredients. Incredible Flavor.", "Dinner Is Served.", "Your New Favorite Restaurant"],
    anchorHeadlines: ["Experience the Best Food in the Neighborhood — Made Fresh Daily.", "Family Recipes. Local Ingredients. Unforgettable Meals.", "Dine In. Take Out. Catering. We Do It All."],
    subheadlines:    ["Family-owned & serving the community since 2008.", "Dine-in, takeout & catering available."],
    offers:          ["10% Off Your First Order", "Free Dessert with Entree", "Catering Free Consultation"],
    ctas:            ["Order Now", "Reserve Your Table", "Visit Us Today"],
    taglines:        ["Fresh. Local. Delicious.", "Where Every Meal Is a Memory"],
    badges:          ["10% OFF", "CATERING", "DINE-IN & TAKEOUT"],
  },

  // ── Law / Legal ──────────────────────────────────────────────────────────────
  law: {
    key: "law", label: "Law / Legal", icon: "⚖️",
    imageIdeal: "Professional attorney portrait, office library, or courthouse exterior",
    palette: palette("#1A237E", "#C8A84B", "#283593", "#0D1257"),
    headlines:       ["You Need the Right Attorney.", "Protect Your Rights.", "Experience You Can Trust"],
    anchorHeadlines: ["When It Matters Most, You Need an Attorney Who Fights for You.", "Personal Injury, Family Law & Estate Planning — Free Consultation.", "Decades of Experience. Real Results. Call Today."],
    subheadlines:    ["Free consultations. No fee unless you win.", "Serving Northeast Ohio for over 20 years."],
    offers:          ["Free Initial Consultation", "No Fee Unless We Win", "Free Case Evaluation"],
    ctas:            ["Call for Free Consultation", "Schedule Today", "Get a Free Case Review"],
    taglines:        ["Fighting for You Every Step of the Way", "Your Rights. Our Mission."],
    badges:          ["FREE CONSULT", "NO FEE UNLESS YOU WIN", "CALL TODAY"],
  },

  // ── Veterinary ──────────────────────────────────────────────────────────────
  veterinary: {
    key: "veterinary", label: "Veterinary", icon: "🐾",
    imageIdeal: "Happy pet with vet, puppy or kitten, or welcoming clinic",
    palette: palette("#2E7D32", "#1565C0", "#388E3C", "#1B5E20"),
    headlines:       ["Your Pet Deserves the Best.", "Expert Care for Your Furry Family.", "Trusted Pet Care, Right Here"],
    anchorHeadlines: ["Because Your Pet Is Family — Expert Veterinary Care You Can Count On.", "Accepting New Patients — Dogs, Cats & More.", "Compassionate Care for Every Pet. From Wellness to Emergency."],
    subheadlines:    ["Wellness, dental, surgery & emergency care.", "Accepting new patients. Most pet insurance accepted."],
    offers:          ["Free First Wellness Visit", "$25 Off New Patient Exam", "Free Heartworm Test with Annual Visit"],
    ctas:            ["Book Your Pet's Appointment", "Call to Schedule", "Claim Your Offer"],
    taglines:        ["Where Pets Are Family", "Compassionate. Professional. Local."],
    badges:          ["NEW PATIENTS", "FREE VISIT", "$25 OFF"],
  },

  // ── General (Fallback) ────────────────────────────────────────────────────────
  general: {
    key: "general", label: "General Business", icon: "🏢",
    imageIdeal: "Team photo, storefront, or product/service in action",
    palette: palette("#1E3A5F", "#2E86AB", "#2463A0", "#0F2340"),
    headlines:       ["Quality Service You Can Count On.", "Your Local Experts.", "Trusted by Your Neighbors"],
    anchorHeadlines: ["Professional Service, Local Expertise — Right in Your Neighborhood.", "Trusted by Hundreds of Local Homeowners.", "Call Today for a Free Consultation."],
    subheadlines:    ["Serving your area since 2005.", "Licensed, insured & locally owned."],
    offers:          ["Free Consultation", "Special Offer for New Customers", "10% Off Your First Service"],
    ctas:            ["Call for a Free Estimate", "Schedule Today", "Get Your Offer"],
    taglines:        ["Locally Owned. Community Focused.", "Your Neighborhood Experts"],
    badges:          ["FREE ESTIMATE", "NEW CUSTOMERS", "LIMITED TIME"],
  },
};

// ── Lookup Helpers ────────────────────────────────────────────────────────────

/** Normalize category string to template key */
export function resolveTemplateKey(category: string): string {
  const normalized = category.toLowerCase().replace(/[\s\-\/]+/g, "_");

  const ALIASES: Record<string, string> = {
    "hvac_heating": "hvac", "heating_cooling": "hvac", "air_conditioning": "hvac",
    "med_spa": "medspa", "medical_spa": "medspa", "aesthetics": "medspa",
    "real_estate": "real_estate", "realtor": "real_estate", "realty": "real_estate",
    "roofer": "roofing", "roofing_contractor": "roofing",
    "plumber": "plumbing", "drain_cleaning": "plumbing",
    "chiro": "chiropractic", "chiropractor": "chiropractic",
    "auto": "auto_repair", "mechanic": "auto_repair", "car_repair": "auto_repair",
    "gym": "fitness", "personal_training": "fitness",
    "food": "restaurant", "cafe": "restaurant", "catering": "restaurant",
    "attorney": "law", "lawyer": "law", "legal": "law",
    "vet": "veterinary", "animal_hospital": "veterinary",
    "house_cleaning": "cleaning", "maid_service": "cleaning", "janitorial": "cleaning",
    "lawn_care": "landscaping", "lawn_service": "landscaping",
    "insurance_agent": "insurance", "life_insurance": "insurance",
  };

  return ALIASES[normalized] ?? (CATEGORY_TEMPLATES[normalized] ? normalized : "general");
}

export function getTemplate(category: string): CategoryTemplate {
  const key = resolveTemplateKey(category);
  return CATEGORY_TEMPLATES[key] ?? CATEGORY_TEMPLATES.general;
}

/** All categories for dropdowns */
export function getAllCategories(): Array<{ key: string; label: string; icon: string }> {
  return Object.values(CATEGORY_TEMPLATES).map(({ key, label, icon }) => ({ key, label, icon }));
}
