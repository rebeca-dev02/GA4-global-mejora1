# Google Ads Conversion Mapping Audit

Source validation used in this audit:
- Google Ads API live inspection across the active MCC child accounts
- GTM web container dumps by country
- BigQuery raw conversion action names from the Google Ads transfer

Traceability used in this audit:

`trigger GTM -> Google Ads tag -> Google Ads conversion action -> BigQuery action_name -> SQL bucket`

## Current SQLX logic

File: `definitions/custom/02_intermediate/src_google_ads_performance.sqlx`

There is currently one active conversion bucketing block in the model:

- `conversion_stats`
  - audited block
  - used by the final `SELECT`
  - uses `includes/custom/google_ads_conversion_mapping.js`

Current active bucketing in `conversion_stats`:

- `crm`
  - `Cualificado*`
  - `Positivo*`
  - `Formulario_04*`
- `form`
  - `Form`
  - `Website lead`
  - `Envío de formulario para clientes potenciales`
  - `Lead form - Submit`
  - `Formularios`
  - `Lead Submit`
  - `Prosegur Paraguay - GA4 (web) generate_lead`
- `call`
  - `CMB`
  - `C2C`
  - `Llamadas desde anuncios (GAds)`
  - `Llamadas a teléfono en sitio web (desvío de llamada)`
  - `Clics en el número de teléfono en tu sitio web móvi (C2C)`
  - `Prosegur Paraguay - GA4 (web) c2c`
- `visita`
  - any action matching `%Visita%`
- `no_gestionado`
  - `No Cualificado`
  - `NoUtil_formulario_02`
  - `No Gestionado_formulario`
  - any action matching `%No Gestionado%` or `%NoGestionado%`

## Recommended mapping

| action_name | current_sqlx_bucket | recommended_bucket | notes |
| --- | --- | --- | --- |
| `Website lead` | form | form | Spain specific case. GTM `Form` and `CMB` both send to the same Google Ads action, so SQL cannot split them later. |
| `Form` | form | form | Confirmed in BR, CL, CO, CRI, ECU, PT, PY, DE. |
| `Lead form - Submit` | form | form | Confirmed in AR, PE and Cipher BR. |
| `Envío de formulario para clientes potenciales` | form | form | Confirmed in Cipher nueva. |
| `Formularios` | form | form | Confirmed in Cipher. |
| `Lead Submit` | form | form | Confirmed in Cipher BR. |
| `Prosegur Paraguay - GA4 (web) generate_lead` | form | form | Imported GA4 lead action used as form bucket in Paraguay. |
| `CMB` | call | call | Business callback/contact bucket. Technically many GTM triggers are form submits, but reporting treats them as call/contact. |
| `C2C` | call | call | Confirmed click-to-call action in Ads API and GTM. |
| `Llamadas desde anuncios (GAds)` | call | call | Google Ads `AD_CALL` action. |
| `Llamadas a teléfono en sitio web (desvío de llamada)` | call | call | Google Ads `WEBSITE_CALL` action. |
| `Clics en el número de teléfono en tu sitio web móvi (C2C)` | call | call | Google Ads `CLICK_TO_CALL` action. |
| `Prosegur Paraguay - GA4 (web) c2c` | call | call | Imported GA4 click-to-call action used in Paraguay. |
| `Cualificado*` | crm | crm | Offline/imported CRM stage family. |
| `Positivo*` | crm | crm | Offline/imported CRM stage family. |
| `Formulario_04*` | crm | crm | Offline/imported CRM stage family; current active mapping already covers variants. |
| `No Cualificado` | no_gestionado | no_gestionado | Negative lead state; must never fall into `crm`. |
| `NoUtil_formulario_02` | no_gestionado | no_gestionado | Negative/not-useful state. |
| `No Gestionado_formulario` | no_gestionado | no_gestionado | Negative/unmanaged lead state. |
| `No Gestionado*` | no_gestionado | no_gestionado | Keep unmanaged naming family together. |
| `Visita` | visita | visita | Confirmed as visit-stage action. |
| `CIPHER - Visita` | visita | visita | Confirmed in Cipher account. |
| `Conversation started` | unclassified | ignored | Ignored in the lead model; excluded from coverage checks. |
| `Compra` | unclassified | ignored | Ignored in the lead model; excluded from coverage checks. |
| `Purchase` | unclassified | ignored | Ignored in the lead model; excluded from coverage checks. |
| `Checkout` | unclassified | ignored | Ignored in the lead model; excluded from coverage checks. |
| `Inicio de la tramitación de la compra` | unclassified | ignored | Ignored in the lead model; excluded from coverage checks. |

## Country highlights

- `ES`
  - GTM `Form` and GTM `CMB` both end up in the same Google Ads conversion action: `Website lead`.
  - SQL cannot recover that split after the fact.
  - `Llamadas desde anuncios (GAds)` and `click-to-call` actions are separate and remain valid in `call`.

- `BR`
  - `Form`, `CMB`, `C2C`, `Visita`, `Cualificado`, `Formulario_04`, `No Gestionado` and `No Cualificado` naming families exist.
  - `No Cualificado` was the main historical risk because it could be mistaken for `crm`.

- `CO`
  - Similar to Brazil for `Cualificado`, `No Cualificado`, `No Gestionado`, `Visita`.
  - The audited mapping keeps positive CRM stages apart from negative states.

- `PY`
  - Imported GA4 actions `generate_lead` and `c2c` are part of the effective reporting logic and need explicit mapping.

- `DE`
  - `Form`, `CMB`, `C2C` and CRM stages are valid.
  - No additional negative state family was promoted during this audit.

- `Cipher`
  - `Formularios`, `Lead Submit` and `CIPHER - Visita` needed explicit coverage because they do not follow the main country naming.

## Important modeling note

The file has already been cleaned so only the audited `conversion_stats` block remains. Google Ads now has one active conversion mapping path, which makes maintenance clearer and avoids confusion between legacy and active logic.
