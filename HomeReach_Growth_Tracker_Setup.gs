/**
 * HomeReach Growth Intelligence Tracker — Auto-Setup Script
 *
 * HOW TO USE:
 *  1. Open the sheet at https://docs.google.com/spreadsheets/d/1DGlGjRU1y7mXVWlQvhqtwT7fDR34LDPEvF-BUle9t_E
 *  2. Click Extensions → Apps Script
 *  3. Paste this entire script into the editor (replace any existing code)
 *  4. Click Run → setupGrowthTracker
 *  5. Authorize when prompted
 *  6. Return to the sheet — all tabs are built automatically
 *
 * This sets up 5 tabs:
 *   📊 Dashboard    — daily KPIs vs targets, auto-calculated from log
 *   📝 Daily Log    — where you enter activity each day (one row = one day)
 *   📣 Channel Log  — detailed per-channel breakdown (one row = one channel/day)
 *   🏙️ City Tracker — track which cities are filled
 *   ⚙️ Benchmarks   — benchmark targets (editable)
 */

function setupGrowthTracker() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Remove default "Sheet1" if it exists ──────────────────────────────────
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet) {
    // We'll delete it at the end after other sheets exist
  }

  // ── 1. BENCHMARKS TAB ─────────────────────────────────────────────────────
  let bmSheet = ss.getSheetByName("⚙️ Benchmarks");
  if (!bmSheet) bmSheet = ss.insertSheet("⚙️ Benchmarks");
  bmSheet.clearContents();
  bmSheet.clearFormats();

  const bmData = [
    ["HomeReach Growth Benchmarks", "", "", "", ""],
    ["", "", "", "", ""],
    ["DEALS & CONVERSATIONS", "", "", "", ""],
    ["Metric", "Low Target", "High Target", "", ""],
    ["Deals per day",         3,  6,  "", ""],
    ["Conversations per day", 15, 30, "", ""],
    ["Cities to fill",        10, 12, "", ""],
    ["Weeks to fill",         4,  4,  "", ""],
    ["", "", "", "", ""],
    ["CHANNEL BENCHMARKS", "", "", "", ""],
    ["Channel", "Daily Volume Target", "Response Rate Low", "Response Rate High", "Notes"],
    ["Email",         50, "3%",  "8%",  "Replies / emails sent"],
    ["SMS",           30, "10%", "25%", "Replies / SMS sent"],
    ["Facebook DM",   50, "15%", "35%", "Replies / DMs sent"],
    ["Facebook Posts",15, "—",  "—",   "Target: 5-15 inbound leads/day"],
    ["Facebook Ads",   1, "—",  "—",   "$50/day ad spend · 3-10 leads/day"],
  ];
  bmSheet.getRange(1, 1, bmData.length, 5).setValues(bmData);

  // Formatting
  bmSheet.getRange("A1").setFontSize(16).setFontWeight("bold");
  bmSheet.getRange("A3").setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white");
  bmSheet.getRange("A10").setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white");
  bmSheet.getRange("A4:D4").setFontWeight("bold").setBackground("#e8f0fe");
  bmSheet.getRange("A11:E11").setFontWeight("bold").setBackground("#e8f0fe");
  bmSheet.setColumnWidth(1, 180);
  bmSheet.setColumnWidth(2, 160);
  bmSheet.setColumnWidth(3, 160);
  bmSheet.setColumnWidth(4, 160);
  bmSheet.setColumnWidth(5, 250);

  // ── 2. CHANNEL LOG TAB ────────────────────────────────────────────────────
  let clSheet = ss.getSheetByName("📣 Channel Log");
  if (!clSheet) clSheet = ss.insertSheet("📣 Channel Log");
  clSheet.clearContents();
  clSheet.clearFormats();

  const clHeaders = [
    "Date", "Channel", "Volume Sent", "Ad Spend ($)", "Responses",
    "Response Rate", "Volume Target", "Rate Target (Low)", "Rate Target (High)",
    "Volume Variance", "Rate Variance", "Conversations Started", "Deals Closed", "Notes"
  ];
  clSheet.getRange(1, 1, 1, clHeaders.length).setValues([clHeaders]);
  clSheet.getRange("A1:N1").setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white");

  // Add formula rows for channel benchmarks (rows 2+)
  // Row 2 = example row with formulas
  const clExample = [
    new Date(), "Email", 0, 0, 0,
    '=IF(C2>0, E2/C2, "")',                              // Response Rate
    '=IFERROR(VLOOKUP(B2,\'⚙️ Benchmarks\'!A12:B16,2,0),"")', // Volume Target
    '=IFERROR(VLOOKUP(B2,\'⚙️ Benchmarks\'!A12:C16,3,0),"")', // Rate Target Low
    '=IFERROR(VLOOKUP(B2,\'⚙️ Benchmarks\'!A12:D16,4,0),"")', // Rate Target High
    '=IF(G2="","",IF(G2>0,(C2-G2)/G2,""))',              // Volume Variance
    '=IF(H2="","",IF(F2="","",IF(H2>0,(F2-H2)/H2,"")))', // Rate Variance
    0, 0, ""
  ];
  clSheet.getRange(2, 1, 1, clHeaders.length).setValues([clExample]);

  // Format
  clSheet.getRange("F:F").setNumberFormat("0.0%");
  clSheet.getRange("H:H").setNumberFormat("0.0%");
  clSheet.getRange("I:I").setNumberFormat("0.0%");
  clSheet.getRange("J:J").setNumberFormat("+0.0%;-0.0%;0.0%");
  clSheet.getRange("K:K").setNumberFormat("+0.0%;-0.0%;0.0%");
  clSheet.getRange("D:D").setNumberFormat("$#,##0.00");

  // Conditional formatting for variance columns
  const jRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0).setBackground("#c6efce").build();
  const jRuleNeg = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(-0.2).setBackground("#ffc7ce").build();
  clSheet.setConditionalFormatRules([jRule, jRuleNeg]);

  clSheet.setColumnWidth(1, 100);
  clSheet.setColumnWidth(2, 130);
  clSheet.setColumnWidth(14, 200);
  clSheet.setFrozenRows(1);

  // Add data validation for Channel column
  const channelRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Email", "SMS", "Facebook DM", "Facebook Posts", "Facebook Ads"])
    .setAllowInvalid(false)
    .build();
  clSheet.getRange("B2:B1000").setDataValidation(channelRule);

  // ── 3. DAILY LOG TAB ─────────────────────────────────────────────────────
  let dlSheet = ss.getSheetByName("📝 Daily Log");
  if (!dlSheet) dlSheet = ss.insertSheet("📝 Daily Log");
  dlSheet.clearContents();
  dlSheet.clearFormats();

  const dlHeaders = [
    "Date",
    // Email
    "Email Sent", "Email Replies", "Email Rate",
    // SMS
    "SMS Sent", "SMS Replies", "SMS Rate",
    // Facebook DM
    "FB DMs Sent", "FB DM Replies", "DM Rate",
    // Facebook Posts
    "FB Posts", "FB Post Leads",
    // Facebook Ads
    "Ad Spend ($)", "Ad Leads",
    // Totals
    "Total Conversations", "Deals Closed",
    // Calculated
    "Conv. Rate", "Daily Notes"
  ];
  dlSheet.getRange(1, 1, 1, dlHeaders.length).setValues([dlHeaders]);
  dlSheet.getRange(1, 1, 1, dlHeaders.length).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white");

  // Group headers with colors
  dlSheet.getRange("B1:D1").setBackground("#0f4c81").setFontColor("white");   // Email (blue)
  dlSheet.getRange("E1:G1").setBackground("#1a6040").setFontColor("white");   // SMS (green)
  dlSheet.getRange("H1:J1").setBackground("#5c1b8c").setFontColor("white");   // DM (purple)
  dlSheet.getRange("K1:L1").setBackground("#8b4000").setFontColor("white");   // Posts (brown)
  dlSheet.getRange("M1:N1").setBackground("#8b0000").setFontColor("white");   // Ads (red)
  dlSheet.getRange("O1:R1").setBackground("#333333").setFontColor("white");   // Totals

  // Example row with formulas
  const dlExample = [
    new Date(),
    50, 0, "=IF(B2>0,C2/B2,\"\")",   // Email
    30, 0, "=IF(E2>0,F2/E2,\"\")",   // SMS
    50, 0, "=IF(H2>0,I2/H2,\"\")",   // DM
    15, 0,                            // Posts
    0, 0,                             // Ads
    0, 0,                             // Convos + Deals
    "=IF(P2>0,Q2/P2,\"\")",          // Conv rate
    ""                                // Notes
  ];
  dlSheet.getRange(2, 1, 1, dlHeaders.length).setValues([dlExample]);

  // Format rate columns as %
  dlSheet.getRange("D:D").setNumberFormat("0.0%");
  dlSheet.getRange("G:G").setNumberFormat("0.0%");
  dlSheet.getRange("J:J").setNumberFormat("0.0%");
  dlSheet.getRange("R:R").setNumberFormat("0.0%");
  dlSheet.getRange("M:M").setNumberFormat("$#,##0.00");

  // Target reference row (row 1 of a "targets" helper — we'll use conditional formatting instead)
  // Conditional formatting: Email rate red if < 3%
  const emailRateRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.03).setBackground("#ffc7ce").setFontColor("#9c0006")
    .setRanges([dlSheet.getRange("D2:D1000")]).build();
  const smsRateRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.10).setBackground("#ffc7ce").setFontColor("#9c0006")
    .setRanges([dlSheet.getRange("G2:G1000")]).build();
  const dmRateRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0.15).setBackground("#ffc7ce").setFontColor("#9c0006")
    .setRanges([dlSheet.getRange("J2:J1000")]).build();
  const dealsGoodRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(3).setBackground("#c6efce").setFontColor("#276221")
    .setRanges([dlSheet.getRange("Q2:Q1000")]).build();
  const dealsBadRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(3).setBackground("#ffeb9c").setFontColor("#9c6500")
    .setRanges([dlSheet.getRange("Q2:Q1000")]).build();

  dlSheet.setConditionalFormatRules([emailRateRule, smsRateRule, dmRateRule, dealsGoodRule, dealsBadRule]);
  dlSheet.setFrozenRows(1);
  dlSheet.setColumnWidth(1, 100);
  dlSheet.setColumnWidth(18, 250);

  // ── 4. CITY TRACKER TAB ───────────────────────────────────────────────────
  let ctSheet = ss.getSheetByName("🏙️ City Tracker");
  if (!ctSheet) ctSheet = ss.insertSheet("🏙️ City Tracker");
  ctSheet.clearContents();
  ctSheet.clearFormats();

  ctSheet.getRange("A1").setValue("🏙️ HomeReach City Fill Progress").setFontSize(16).setFontWeight("bold");
  ctSheet.getRange("A2").setValue("Target: 10–12 cities within 4 weeks of launch");
  ctSheet.getRange("A3").setFormula('="Cities filled: "&COUNTIF(D:D,"✅")&" / "&COUNTA(A5:A100)-COUNTBLANK(A5:A100)&" total"');
  ctSheet.getRange("A3").setFontWeight("bold").setFontColor("#1a6040");

  const cityHeaders = ["City", "State", "Date Added", "Status", "Active Spots", "Product Types", "MRR ($)", "Notes"];
  ctSheet.getRange(4, 1, 1, cityHeaders.length).setValues([cityHeaders]);
  ctSheet.getRange(4, 1, 1, cityHeaders.length).setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white");

  // Status dropdown
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["🔴 Not Started", "🟡 Outreach Active", "🟠 Deal in Progress", "✅ Filled", "⛔ Not Targeting"])
    .setAllowInvalid(false).build();
  ctSheet.getRange("D5:D100").setDataValidation(statusRule);

  // MRR format
  ctSheet.getRange("G5:G100").setNumberFormat("$#,##0");

  ctSheet.setColumnWidth(1, 160);
  ctSheet.setColumnWidth(2, 60);
  ctSheet.setColumnWidth(3, 110);
  ctSheet.setColumnWidth(4, 160);
  ctSheet.setColumnWidth(5, 100);
  ctSheet.setColumnWidth(6, 160);
  ctSheet.setColumnWidth(7, 100);
  ctSheet.setColumnWidth(8, 200);
  ctSheet.setFrozenRows(4);

  // ── 5. DASHBOARD TAB ─────────────────────────────────────────────────────
  let dashSheet = ss.getSheetByName("📊 Dashboard");
  if (!dashSheet) dashSheet = ss.insertSheet("📊 Dashboard", 0);
  dashSheet.clearContents();
  dashSheet.clearFormats();

  dashSheet.getRange("A1").setValue("📊 HomeReach Growth Intelligence Dashboard")
    .setFontSize(18).setFontWeight("bold");
  dashSheet.getRange("A2").setFormula('="Last updated: "&TEXT(NOW(),"MMM d, yyyy h:mm AM/PM")');
  dashSheet.getRange("A2").setFontColor("#666666").setFontSize(10);

  // KPI section
  const kpiRow = 4;
  const kpiData = [
    ["🎯 DEALS PERFORMANCE", "", "", "📣 CHANNEL SUMMARY (Last 7 Days)", "", "", ""],
    ["Metric", "Actual", "Target", "Channel", "Volume", "Responses", "Rate"],
    ['=TEXT(TODAY(),"MMM d")+0', // trick to show "Today"
     '=COUNTIF(\'📝 Daily Log\'!A:A,TODAY())*0+SUMIF(\'📝 Daily Log\'!A:A,TODAY(),\'📝 Daily Log\'!Q:Q)',
     "3-6",
     "Email",
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Email"),\'📣 Channel Log\'!C2:C1000)',
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Email"),\'📣 Channel Log\'!E2:E1000)',
     '=IFERROR(E6/D6,"")'],
    ["This Week",
     '=SUMPRODUCT((\'📝 Daily Log\'!A2:A1000>=TODAY()-6)*1,\'📝 Daily Log\'!Q2:Q1000)',
     "21–42",
     "SMS",
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="SMS"),\'📣 Channel Log\'!C2:C1000)',
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="SMS"),\'📣 Channel Log\'!E2:E1000)',
     '=IFERROR(E7/D7,"")'],
    ["This Month",
     '=SUMPRODUCT((MONTH(\'📝 Daily Log\'!A2:A1000)=MONTH(TODAY()))*(YEAR(\'📝 Daily Log\'!A2:A1000)=YEAR(TODAY())),\'📝 Daily Log\'!Q2:Q1000)',
     "90–180",
     "Facebook DM",
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Facebook DM"),\'📣 Channel Log\'!C2:C1000)',
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Facebook DM"),\'📣 Channel Log\'!E2:E1000)',
     '=IFERROR(E8/D8,"")'],
    ["", "", "",
     "FB Posts",
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Facebook Posts"),\'📣 Channel Log\'!C2:C1000)',
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Facebook Posts"),\'📣 Channel Log\'!E2:E1000)',
     "—"],
    ["", "", "",
     "FB Ads",
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Facebook Ads"),\'📣 Channel Log\'!D2:D1000)',
     '=SUMPRODUCT((\'📣 Channel Log\'!A2:A1000>=TODAY()-6)*(\'📣 Channel Log\'!B2:B1000="Facebook Ads"),\'📣 Channel Log\'!E2:E1000)',
     "—"],
  ];

  dashSheet.getRange(kpiRow, 1, kpiData.length, 7).setValues(kpiData);

  // Headers
  dashSheet.getRange(kpiRow, 1, 1, 3).merge().setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setFontSize(11);
  dashSheet.getRange(kpiRow, 4, 1, 4).merge().setFontWeight("bold").setBackground("#1e3a5f").setFontColor("white").setFontSize(11);
  dashSheet.getRange(kpiRow+1, 1, 1, 3).setFontWeight("bold").setBackground("#e8f0fe");
  dashSheet.getRange(kpiRow+1, 4, 1, 4).setFontWeight("bold").setBackground("#e8f0fe");

  // Rate formatting
  dashSheet.getRange(5, 7, 4, 1).setNumberFormat("0.0%");

  // City progress
  const cityRow = kpiRow + kpiData.length + 2;
  dashSheet.getRange(cityRow, 1).setValue("🏙️ CITY FILL PROGRESS")
    .setFontWeight("bold").setFontSize(12).setBackground("#1e3a5f").setFontColor("white");
  dashSheet.getRange(cityRow, 2).setValue("");
  dashSheet.getRange(cityRow+1, 1).setFormula('="Filled: "&COUNTIF(\'🏙️ City Tracker\'!D:D,"✅")&" of "&\'⚙️ Benchmarks\'!C7&" target"');
  dashSheet.getRange(cityRow+1, 1).setFontWeight("bold").setFontSize(14);
  dashSheet.getRange(cityRow+2, 1).setFormula('=COUNTIF(\'🏙️ City Tracker\'!D:D,"🟡 Outreach Active")&" cities with active outreach"');
  dashSheet.getRange(cityRow+3, 1).setFormula('=COUNTIF(\'🏙️ City Tracker\'!D:D,"🟠 Deal in Progress")&" deals currently in progress"');

  // Conversations section
  const convRow = cityRow + 5;
  dashSheet.getRange(convRow, 1).setValue("💬 CONVERSATIONS & FUNNEL (7 days)")
    .setFontWeight("bold").setFontSize(11).setBackground("#1e3a5f").setFontColor("white");
  dashSheet.getRange(convRow+1, 1).setValue("Conversations started");
  dashSheet.getRange(convRow+1, 2).setFormula('=SUMPRODUCT((\'📝 Daily Log\'!A2:A1000>=TODAY()-6)*1,\'📝 Daily Log\'!P2:P1000)');
  dashSheet.getRange(convRow+1, 3).setValue("target: 105–210");
  dashSheet.getRange(convRow+2, 1).setValue("Deals closed");
  dashSheet.getRange(convRow+2, 2).setFormula('=SUMPRODUCT((\'📝 Daily Log\'!A2:A1000>=TODAY()-6)*1,\'📝 Daily Log\'!Q2:Q1000)');
  dashSheet.getRange(convRow+2, 3).setValue("target: 21–42");
  dashSheet.getRange(convRow+3, 1).setValue("Close rate");
  dashSheet.getRange(convRow+3, 2).setFormula('=IFERROR(SUMPRODUCT((\'📝 Daily Log\'!A2:A1000>=TODAY()-6)*1,\'📝 Daily Log\'!Q2:Q1000)/SUMPRODUCT((\'📝 Daily Log\'!A2:A1000>=TODAY()-6)*1,\'📝 Daily Log\'!P2:P1000),"")');
  dashSheet.getRange(convRow+3, 2).setNumberFormat("0.0%");

  // Column widths
  dashSheet.setColumnWidth(1, 200);
  dashSheet.setColumnWidth(2, 140);
  dashSheet.setColumnWidth(3, 120);
  dashSheet.setColumnWidth(4, 160);
  dashSheet.setColumnWidth(5, 100);
  dashSheet.setColumnWidth(6, 100);
  dashSheet.setColumnWidth(7, 80);

  // ── Delete default Sheet1 if it still exists ──────────────────────────────
  const toDelete = ss.getSheetByName("Sheet1");
  if (toDelete && ss.getSheets().length > 1) {
    ss.deleteSheet(toDelete);
  }

  // ── Move Dashboard to first position ─────────────────────────────────────
  ss.setActiveSheet(dashSheet);
  ss.moveActiveSheet(1);

  // ── Done ──────────────────────────────────────────────────────────────────
  SpreadsheetApp.getUi().alert(
    "✅ HomeReach Growth Tracker Setup Complete!\n\n" +
    "5 tabs created:\n" +
    "• 📊 Dashboard — auto-calculated KPIs\n" +
    "• 📝 Daily Log — enter daily totals here\n" +
    "• 📣 Channel Log — detailed per-channel breakdown\n" +
    "• 🏙️ City Tracker — track city progress\n" +
    "• ⚙️ Benchmarks — edit targets here\n\n" +
    "Start by entering today's activity in 📝 Daily Log."
  );
}
