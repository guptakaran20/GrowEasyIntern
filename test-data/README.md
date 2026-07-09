# Test Data Catalog

| File | Category | Purpose |
|------|----------|---------|
| `valid/01_exact_schema.csv` | Golden path | Exact GrowEasy columns |
| `valid/02_facebook_export.csv` | Golden path | Facebook Lead Ads format |
| `valid/03_google_ads.csv` | Golden path | Google Ads conversion export |
| `valid/04_real_estate.csv` | Golden path | Property CRM messy fields |
| `valid/all_crm_fields.csv` | Golden path | All 15 CRM field aliases |
| `messy/05_weird_headers.csv` | Mapping | Completely different column names |
| `messy/06_ambiguous_columns.csv` | AI mapping | Contact/Owner/Status ambiguity |
| `messy/07_multiple_contacts.csv` | Extraction | Multiple emails and phones |
| `messy/08_invalid_records.csv` | Validation | Missing email and mobile |
| `messy/09_messy_dates.csv` | Dates | Mixed date formats |
| `messy/10_status_variations.csv` | Enums | Semantic CRM status mapping |
| `messy/11_data_sources.csv` | Enums | Allowed and unknown sources |
| `messy/12_csv_edge_cases.csv` | Parser | Quotes, commas, Unicode, emojis |
| `messy/13_empty_values.csv` | Resilience | Sparse rows |
| `messy/14_irrelevant_columns.csv` | Mapping | Noise columns to ignore |
| `messy/mapping_variant_[a-d].csv` | AI mapping | Same data, 4 header styles |
| `adversarial/17_prompt_injection.csv` | Security | Prompt injection in cells |
| `invalid/18_malformed.csv` | Errors | Broken CSV structure |
| `invalid/19_empty.csv` | Errors | Empty file |
| `invalid/20_duplicate_headers.csv` | Parser | Duplicate column names |
| `performance/15_large_1000_rows.csv` | Performance | 1K rows (generated) |
| `performance/16_large_10000_rows.csv` | Stress | 10K rows at limit |

See [TESTING.md](../TESTING.md) for the full manual and automated test plan.
