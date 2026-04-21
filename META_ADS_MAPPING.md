# Meta Ads Conversion Mapping Audit

Source validation used in this audit:
- GTM web container dumps by country
- Meta live `event-breakdown --days 30`
- BigQuery raw `meta_api_insights.ad_insights` conversion names

## Current SQLX logic

File: `definitions/custom/02_intermediate/src_meta_ads_ad_daily.sqlx`

- `conversions_cmb`: any conversion name matching `%cmb%`
- `conversions_form`: only `Form`, `form`, `Formulario Contacto`
- `conversions_cualificado`: only `Cualificado`
- `conversions_contact`: only `contact_total`
- `conversions_no_gestionado`: only `No Gestionado`
- `conversions_no_cualificado`: `No Cualificado`, `Cuelga`, `Telefono Erroneo`, `Registro Error`
- `conversions_cualificado_negativo`: `Cualificado Negativo`, `Baja Recaudacion`
- `conversions_total`: all conversions

File: `definitions/custom/02_intermediate/int_campaign_performance_daily_base.sqlx`

- `platform_conversions_call = conversions_cmb + conversions_contact`
- `platform_conversions_visita = conversions_visita`
- `platform_conversions_no_gestionado = conversions_no_gestionado`
- `platform_conversions_no_cualificado = conversions_no_cualificado`
- `platform_conversions_cualificado_negativo = conversions_cualificado_negativo`

## Recommended mapping

| conversion_name | current_sqlx_bucket | recommended_bucket | notes |
| --- | --- | --- | --- |
| `offsite_conversion.fb_pixel_custom.Form` | form | form | Present in BR, PE, PT, DE raw data and GTM. |
| `offsite_conversion.fb_pixel_custom.form` | form | form | Present in AR, CL, CO, CRI, ECU, MEX, PY, UY raw/GTM. |
| `offsite_conversion.fb_pixel_custom.Formulario Contacto` | form | form | Spain naming. |
| `offsite_conversion.fb_pixel_custom.CMB` / `...cmb` | cmb | call | Business callback/contact bucket. |
| `contact_total` | contact | call | Paraguay raw export. |
| `contact_website` | unclassified | call | Paraguay raw export, should not be dropped. |
| `offsite_conversion.fb_pixel_custom.c2c` | unclassified | call | Seen in GTM and Meta live events for AR, CL, CO, CRI, MEX, PE, PY, UY. |
| `offsite_conversion.fb_pixel_custom.click to call` | unclassified | call | Seen in ES and BR live events. |
| `offsite_conversion.fb_pixel_custom.click_to_whatsapp` | unclassified | call | Seen in BR, AR, PE live events. |
| `offsite_conversion.fb_pixel_custom.Cualificado` | cualificado | crm | Raw export qualified lead state. |
| `offsite_conversion.fb_pixel_custom.Visita` | unclassified | visita | Present in raw export for BR, AR, CL, CO, CRI, MEX, PE. |
| `offsite_conversion.fb_pixel_custom.No Cualificado` | unclassified | no_cualificado | Disqualified lead outcome. |
| `offsite_conversion.fb_pixel_custom.No Gestionado` | unclassified | no_gestionado | Unmanaged lead outcome. |
| `offsite_conversion.fb_pixel_custom.Cualificado Negativo` | unclassified | cualificado_negativo | Negative qualified outcome. |
| `offsite_conversion.fb_pixel_custom.Cuelga` | unclassified | no_cualificado | Invalid call outcome. |
| `offsite_conversion.fb_pixel_custom.Telefono Erroneo` | unclassified | no_cualificado | Invalid phone outcome. |
| `offsite_conversion.fb_pixel_custom.Registro Error` | unclassified | no_cualificado | Error outcome. |
| `offsite_conversion.fb_pixel_custom.Baja Recaudacion` | unclassified | cualificado_negativo | Negative outcome present in Peru raw data. |
| `offsite_conversion.fb_pixel_custom.Lead_60s/50%` | unclassified | review | Germany special case; live in Meta API, not observed in BigQuery raw during this audit. |
| `CompleteRegistration` | n/a in raw | review | Visible in live Meta API for CO/PE but not in BigQuery raw conversion names. |

## Country highlights

- `ES`: GTM and Meta live both confirm `Formulario Contacto`, `CMB`, `click to call`.
- `BR`: GTM and Meta live confirm `Form`, `CMB`, `click to call`, `click_to_whatsapp`.
- `AR`: GTM confirms `form`, `cmb`, `c2c`; raw data adds several no-gestionado states.
- `PY`: raw data includes `contact_total` and `contact_website`; only the first was classified before.
- `DE`: `Lead_60s/50%` needs a business decision before being added to a bucket.
