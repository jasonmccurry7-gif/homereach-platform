# Political CSV import formats

Two admin importers exist:

- `/admin/political/routes/import` → `political_routes`
- `/admin/political/organizations/import` → `political_organizations`

Both follow the same pipeline: **upload → preview → commit → rollback**. Every committed batch is tagged with a `political_imports.id` so it can be reversed atomically.

There are **no fake seeds** for political data. See `supabase/seeds/README.md`.

---

## Routes

### Approved data sources

| Source label (in dropdown)    | Where to obtain                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usps_eddm_csv`               | Operator-downloaded export from the USPS EDDM Retail tool: <https://eddm.usps.com/eddm/select-routes.action>. Use the tool's own "Download" button. **Do not scrape.**       |
| `usps_partner_export`         | A bonded mailing partner's facility-route export. Operator must confirm the partner is on the approved-vendor list before uploading.                                          |
| `vendor_export_48hrprint`     | Operator-downloaded CSV from the 48HrPrint UI (<https://www.48hourprint.com/>). The system **never** logs in, scrapes checkout, or bypasses any access control.              |
| `vendor_export_other`         | Operator-downloaded CSV from any other licensed mailing or address-data vendor (Lob, Smarty, Melissa, etc., until those land as direct integrations in Phase 3).             |
| `manual_csv`                  | Operator-built CSV from a primary source they have rights to. Use only when no upstream tool export is available.                                                            |

> **Vendor policy:** all `vendor_export_*` flows are operator-downloaded only. We do not automate vendor logins, scrape checkout pages, or call private vendor endpoints. The full do/don't list and per-vendor steps live at `/admin/political/routes/find-source`.

### Required columns

| Column             | Type    | Notes                                                                |
| ------------------ | ------- | -------------------------------------------------------------------- |
| `state`            | string  | 2-letter US state code. Aliases: `usps_state`, `st`.                 |
| `zip5`             | string  | 5-digit ZIP. Aliases: `zip`, `zip_code`, `zipcode`, `postal_code`.   |
| `carrier_route_id` | string  | USPS carrier route ID (e.g. `C001`, `R001`). Aliases: `route`, `route_id`, `carrier_route`, `crid`. |
| `total_count`      | integer | Total possible deliveries on the route. Aliases: `total`, `total_possible_deliveries`, `deliveries`, `households`. Commas in numbers OK. |

### Optional columns

| Column              | Type    | Notes                                                                                  |
| ------------------- | ------- | -------------------------------------------------------------------------------------- |
| `zip4`              | string  | 4-digit ZIP+4 extension.                                                              |
| `route_type`        | string  | One of `city`, `rural`, `highway`, `po_box`, `general`. Single-letter codes (C/R/H/PO/G) and synonyms ("City Route") are auto-mapped. |
| `residential_count` | integer | Aliases: `residential`, `res_count`, `residential_deliveries`.                         |
| `business_count`    | integer | Aliases: `business`, `biz_count`, `business_deliveries`.                              |
| `county`            | string  |                                                                                        |
| `city`              | string  | Aliases: `town`.                                                                       |

### Dedup rule

A row is **skipped as duplicate** if `(state, zip5, carrier_route_id)` already exists in `political_routes`. This matches the unique index in migration 068.

### Example file

```csv
state,zip5,carrier_route_id,route_type,residential_count,business_count,total_count,county,city
OH,44109,C001,city,612,28,640,Cuyahoga,Cleveland
OH,44109,C002,city,588,31,619,Cuyahoga,Cleveland
```

> **Important:** The values above are illustrative format examples only. Do not commit example rows like these to a production database — pull real numbers from the USPS source.

---

## Organizations

### Approved data sources

| Source label (in dropdown) | Where to obtain                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fec_committees`           | FEC committee master file (cm.txt) from <https://www.fec.gov/data/browse-data/?tab=bulk-data>. Convert from pipe-delimited to CSV before upload (e.g. `csvkit`'s `csvformat -d "|" cm.txt > cm.csv`). |
| `oh_sos_pacs`              | Ohio Secretary of State campaign-finance bulk downloads from <https://www.ohiosos.gov/campaign-finance/>. Use the official CSV export.                                                                |
| `manual_csv`               | Operator-built CSV from a primary source they have rights to.                                                                                                                                         |

### Required columns

| Column       | Type   | Notes                                                                                                                          |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `legal_name` | string | Full legal name as filed. Aliases: `name`, `committee_name`, `organization_name`, `org_name`. Min 2 chars.                     |
| `org_type`   | string | One of: `campaign_committee`, `pac`, `super_pac`, `party_committee`, `advocacy`, `nonprofit_501c4`, `other`. **Single-letter FEC `committee_type` codes are auto-mapped** (P/H/S → campaign_committee, Q/N → pac, O/V/W → super_pac, X/Y/Z → party_committee, etc.). |
| `state`      | string | 2-letter US state code. Aliases: `registration_state`, `st`.                                                                    |

### Optional columns

| Column                  | Type   | Notes                                                                              |
| ----------------------- | ------ | ---------------------------------------------------------------------------------- |
| `display_name`          | string | Aliases: `short_name`, `common_name`.                                              |
| `ein`                   | string | 9-digit IRS EIN. Any format accepted (12-3456789, 123456789); normalized to `##-#######`. **Invalid EIN format → row is rejected** (we don't silently drop). |
| `primary_contact_name`  | string | Aliases: `contact_name`, `treasurer`, `treasurer_name`.                            |
| `primary_contact_email` | string | Lowercased, must look like an email or it's dropped (not rejected).                |
| `primary_contact_phone` | string | No format normalization.                                                            |
| `website`               | string | Auto-prefixed with `https://` if missing scheme.                                   |
| `notes`                 | string |                                                                                    |

### Dedup rule

- If `ein` is present and valid → dedup on **lowercase EIN**.
- Otherwise → dedup on **lowercase `legal_name` + uppercase `state`**.

This applies both within the file (later duplicates skipped) and against existing rows in `political_organizations`.

### FEC bulk-data quick start

The FEC committee master file (`cm.txt`) is pipe-delimited with these columns (in order): `CMTE_ID, CMTE_NM, TRES_NM, CMTE_ST1, CMTE_ST2, CMTE_CITY, CMTE_ST, CMTE_ZIP, CMTE_DSGN, CMTE_TP, CMTE_PTY_AFFILIATION, CMTE_FILING_FREQ, ORG_TP, CONNECTED_ORG_NM, CAND_ID`.

Convert + rename to our format (one approach using `csvkit`):

```bash
csvformat -d "|" cm.txt | \
  csvcut -c CMTE_NM,CMTE_TP,CMTE_ST,TRES_NM | \
  csvgrep -c CMTE_ST -r '^.{2}$' | \
  sed '1s/CMTE_NM/legal_name/; 1s/CMTE_TP/org_type/; 1s/CMTE_ST/state/; 1s/TRES_NM/primary_contact_name/' \
  > fec_committees.csv
```

Upload `fec_committees.csv` with source `fec_committees`. The single-letter committee_type codes will be mapped to our enum automatically.

### Example file

```csv
legal_name,org_type,state,ein,primary_contact_name,website
Some Real Committee for X,pac,OH,12-3456789,Jane Doe,https://example.org
```

> **Important:** Replace illustrative names with real entries from your approved source.

---

## Common: import lifecycle

1. **Preview.** Validates header columns, parses every row, classifies each as `valid` / `duplicate` / `invalid`. Returns the first 200 rows for inspection. No DB writes.
2. **Commit.** Writes an audit row in `political_imports`, then inserts the validated payloads tagged with that audit row's id. If any insert fails, the partial batch is wiped and the audit row is marked `failed`.
3. **Rollback.** Deletes every row tagged with the audit row's `id`, then marks the audit row `rolled_back`. **Blocked for organization batches whose rows are still referenced by `political_campaigns`** — the operator must reassign or delete those campaigns first.

### Audit log

`/admin/political/imports` lists every upload with provenance, row counts, and a Rollback button. The same data is queryable via:

```sql
select * from public.political_import_summary
order by uploaded_at desc;
```

### Hard caps

- File size: **50 MB** (browser-side check)
- Preview rows returned: **200** (counts are accurate across the whole file)
- Commit row cap per call: **50,000** — split bigger files

---

## What about leads, campaigns, plans, scenarios, proposals?

There are **no importers** for those. They must be created from real activity:

- **`political_outreach_leads`** — only via the public `/political` portal or admin-created with a real contact.
- **`political_campaigns`** — created in-app by a sales agent engaging a real candidate.
- **`political_plans` / `_scenarios`** — generated in-app for real campaigns by the quote engine.
- **`political_proposals` / `_orders` / `_contracts`** — generated by the proposal/payment flow.

Bulk seeding any of these tables is a policy violation. See `supabase/seeds/README.md`.
