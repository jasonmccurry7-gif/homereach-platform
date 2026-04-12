# Lead Migration Report

## Summary
- **Total records in Replit export**: 1646
- **Imported**: 1646
- **Deduplicated (skipped)**: 0
- **DNC flagged (imported but marked)**: 0
- **Bad/unformattable phones (skipped phone)**: 0

## Contact Info Coverage
- With phone: 1358 (82.5%)
- With email: 174 (10.6%)
- With Facebook URL: 0 (0.0%)
- Buying signal = TRUE: 651 (39.6%)

## Status Distribution
- queued (never contacted): 431
- contacted (outreach sent): 1215  
- replied (has reply): 0

## How to Run
1. Run migration 20 first (creates tables)
2. Run this file (20b_seed_sales_leads.sql) in Supabase SQL Editor
3. Verify with: `SELECT status, count(*) FROM sales_leads GROUP BY status;`
