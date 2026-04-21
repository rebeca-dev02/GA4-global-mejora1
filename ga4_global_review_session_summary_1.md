# GA4 Global Review Session Summary 1

## Scope

This session focused on reviewing and improving the ETL architecture of the `ga4_global` Dataform project, with special attention to:

- layer responsibilities
- Google Ads and Meta Ads conversion mappings
- mapping coverage assertions
- model naming consistency
- local/Dataform workspace synchronization

## Key Architecture Decisions

- Ignore the hardcoded Google Ads manager-account table naming issue for now.
- Keep heavy transformation, normalization, enrichment, and struct-building logic out of final marts.
- Use the marts only for final reporting KPIs and ratios.
- Move the project toward a medallion-style convention:
  - `src_*` = source/platform-normalized bronze layer
  - `int_*` = intermediate/silver layer
  - `mart_*` = gold/reporting layer
- Do not merge Google Ads performance and click mapping into a single table because they have different grains and responsibilities.
- Use only minimal shared lookups for Google Ads:
  - campaign lookup
  - customer lookup

## Major Refactors Applied

### Intermediate / Mart Refactor

- Added `definitions/custom/02_intermediate/int_session_paid_attribution.sqlx`
- Added `definitions/custom/02_intermediate/int_campaign_performance_daily_base.sqlx`
- Simplified `definitions/custom/03_outputs/mart_session_attribution_enriched.sqlx`
- Simplified `definitions/custom/03_outputs/mart_campaign_performance_daily.sqlx`

### Deprecated Models Disabled

These models were left out of the active architecture with `disabled: true`:

- `definitions/custom/02_intermediate/src_meta_ads_campaign_daily.sqlx`
- `definitions/custom/03_outputs/mart_google_ads_performance.sqlx`
- `definitions/custom/03_outputs/mart_meta_ads_performance.sqlx`

## Google Ads Work

### Audit

Google Ads conversion mapping was audited using:

- Google Ads API
- GTM dumps
- BigQuery raw exports

### Outcomes

- Added `includes/custom/google_ads_conversion_mapping.js`
- Cleaned and updated `definitions/custom/02_intermediate/src_google_ads_performance.sqlx`
- Added explicit handling for:
  - CRM families such as `Cualificado*`, `Positivo*`, `Formulario_04*`
  - Paraguay GA4-imported conversions
  - no-gestionado states
- Left these outside the hard buckets on purpose:
  - `Conversation started` as `review`
  - ecommerce actions such as `Purchase`, `Checkout`, etc. as `out_of_scope`

### Documentation

- Added/updated `GOOGLE_ADS_MAPPING.md`

## Meta Ads Work

### Audit

Meta conversion mapping was audited using:

- Meta API
- GTM dumps
- BigQuery raw exports

### Outcomes

- Added `includes/custom/meta_ads_conversion_mapping.js`
- Updated `definitions/custom/02_intermediate/src_meta_ads_ad_daily.sqlx`
- Added support for:
  - `c2c`
  - `click to call`
  - `click_to_whatsapp`
  - `contact_website`
  - `Visita`
  - negative/no-gestionado states
- Left these outside the hard buckets on purpose:
  - `Lead_60s/50%`
  - `Lead`
  - `CompleteRegistration`

### Documentation

- Added/updated `META_ADS_MAPPING.md`

## Google Ads Lookup Refactor

To reduce duplication without over-fragmenting the graph:

- Added `definitions/custom/02_intermediate/src_google_ads_campaign_lookup.sqlx`
- Added `definitions/custom/02_intermediate/src_google_ads_customer_lookup.sqlx`

Updated consumers:

- `definitions/custom/02_intermediate/src_google_ads_performance.sqlx`
- `definitions/custom/02_intermediate/src_google_ads_click_mapping.sqlx`

## Mapping Coverage Assertions

Two new assertions were added to detect recent conversion names with volume that are not covered by the current mapping:

- `definitions/custom/assertions/assert_google_ads_conversion_mapping_coverage.sqlx`
- `definitions/custom/assertions/assert_meta_ads_conversion_mapping_coverage.sqlx`

These assertions:

- inspect recent raw data
- fail when unmapped conversion names appear with volume
- include percentage-of-source context
- exclude only the explicitly documented `review` and `out_of_scope` cases

## Naming Refactor Applied

The project naming moved from ambiguous `stg_*` usage toward clearer layer semantics:

### Renamed Google Ads Models

- `stg_ads_performance` -> `src_google_ads_performance`
- `stg_ads_click_mapping` -> `src_google_ads_click_mapping`
- `stg_google_ads_campaign_lookup` -> `src_google_ads_campaign_lookup`
- `stg_google_ads_customer_lookup` -> `src_google_ads_customer_lookup`

### Renamed Meta / Intermediate Models

- `stg_meta_ads_ad_daily` -> `src_meta_ads_ad_daily`
- `stg_meta_ads_campaign_daily` -> `src_meta_ads_campaign_daily`
- `stg_google_ads_session_bridge` -> `int_google_ads_session_bridge`
- `stg_session_paid_attribution` -> `int_session_paid_attribution`
- `stg_campaign_performance_daily_base` -> `int_campaign_performance_daily_base`

All affected `ref(...)`, assertions, tests, and docs were updated accordingly.

## Dataform Workspace Sync

The active review workspace during this session was:

- `mejora1-local-review`

Actions performed:

- uploaded changed files to the workspace multiple times as the refactor progressed
- finally removed the old `stg_*` workspace paths
- uploaded the renamed `src_*` and `int_*` versions

The workspace name `mejora1` was checked and does not exist. The valid review workspace found by API was `mejora1-local-review`.

## Local Test Status

The following local regression tests passed after the latest refactors:

- `node tests\\google_ads_incremental_and_grain.test.js`
- `node tests\\meta_ads_helpers.test.js`

These tests validate helper logic and mapping regressions, but they do not replace a full Dataform compile.

## Important Current Status

- Changes exist locally in the repo and in the Dataform workspace `mejora1-local-review`.
- No GitHub push or PR was done during this session.
- No final Dataform recompile has been confirmed after the full `src/int/mart` renaming pass.

## Recommended Next Steps

1. Recompile `mejora1-local-review` in Dataform after the full renaming sync.
2. Confirm that the compile graph reflects the new `src / int / mart` taxonomy.
3. Review the remaining `review` cases:
   - Google Ads: `Conversation started`
   - Meta Ads: `Lead_60s/50%`, `Lead`, `CompleteRegistration`
4. Add a short permanent architecture document describing:
   - bronze/source layer
   - silver/intermediate layer
   - gold/mart layer
   - where business logic is allowed vs not allowed
