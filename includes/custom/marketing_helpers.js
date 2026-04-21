// Country mapping
function buildCountryCodeFromNameSql(columnName) {
  return `
    CASE
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'argentin') THEN 'Argentina'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'brasil|brazil') THEN 'Brasil'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'colombi') THEN 'Colombia'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'peru|perú') THEN 'Peru'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'espana|españa|spain|corporativ') THEN 'Espana'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'paraguay|paragua') THEN 'Paraguay'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'chile') THEN 'Chile'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'portug') THEN 'Portugal'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(${columnName}, '')), r'alemania|aleman|germany|deutschland|german') THEN 'Alemania'
      ELSE 'Other'
    END
  `;
}

// Shared SQL helpers
function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInList(values) {
  return values.map(escapeSqlLiteral).join(", ");
}

// Google Ads incremental helpers
function parseGoogleAdsCustomerId(rawValue) {
  const parsed = Number.parseInt(String(rawValue || "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildGoogleAdsIncrementalDateCheckpointSql(
  selfRef,
  rawValue,
  customerIdColumnName = "customer_id",
  dateColumnName = "date"
) {
  const customerId = parseGoogleAdsCustomerId(rawValue);
  const staleRowsPredicate = customerId === 0
    ? `${customerIdColumnName} IS NOT NULL`
    : `CAST(${customerIdColumnName} AS INT64) != CAST(${customerId} AS INT64)`;
  return `
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ${selfRef}
          WHERE ${staleRowsPredicate}
        ) THEN DATE('2020-01-01')
        ELSE COALESCE(DATE_SUB(MAX(${dateColumnName}), INTERVAL 3 DAY), DATE('2020-01-01'))
      END
    FROM ${selfRef}
  `;
}

// Google Ads conversion mapping
const GOOGLE_ADS_FORM_ACTION_NAMES = [
  "Form",
  "Website lead",
  "Envio de formulario para clientes potenciales",
  "Lead form - Submit",
  "Formularios",
  "Lead Submit",
  "Prosegur Paraguay - GA4 (web) generate_lead"
];

const GOOGLE_ADS_CALL_ACTION_NAMES = [
  "CMB",
  "C2C",
  "Llamadas desde anuncios (GAds)",
  "Llamadas a telefono en sitio web (desvio de llamada)",
  "Clics en el numero de telefono en tu sitio web movi (C2C)",
  "Prosegur Paraguay - GA4 (web) c2c"
];

const GOOGLE_ADS_NO_GESTIONADO_ACTION_NAMES = [
  "No Gestionado_formulario"
];

const GOOGLE_ADS_NO_CUALIFICADO_ACTION_NAMES = [
  "No Cualificado",
  "NoUtil_formulario_02"
];

const GOOGLE_ADS_IGNORED_ACTION_NAMES = [
  "Conversation started",
  "Compra",
  "Purchase",
  "Checkout",
  "Inicio de la tramitacion de la compra"
];

const GOOGLE_ADS_CONVERSION_AUDIT = [
  {
    action_name: "Website lead",
    recommended_bucket: "form",
    scope: "Spain / Prosegur Marketing Corporativo",
    reason: "Official Google Ads action is a webpage submit lead. In Spain, GTM Form and CMB tags both send to this same conversion action, so SQL cannot split them."
  },
  {
    action_name: "Form, Lead form - Submit, Envio de formulario para clientes potenciales, Formularios, Lead Submit, Prosegur Paraguay - GA4 (web) generate_lead",
    recommended_bucket: "form",
    scope: "AR, BR, CL, CO, CRI, ECU, ES, PE, PT, PY, DE, Cipher BR",
    reason: "Validated as form or lead-submit style actions in Google Ads API and GTM."
  },
  {
    action_name: "CMB, C2C, Llamadas desde anuncios (GAds), Llamadas a telefono en sitio web (desvio de llamada), Clics en el numero de telefono en tu sitio web movi (C2C), Prosegur Paraguay - GA4 (web) c2c",
    recommended_bucket: "call",
    scope: "AR, BR, CL, CO, CRI, ECU, ES, PE, PT, PY, DE",
    reason: "These actions are used operationally as call or contact buckets in the ETL."
  },
  {
    action_name: "Cualificado*, Positivo*, Formulario_04*",
    recommended_bucket: "crm",
    scope: "ES, PT, BR, CO, DE",
    reason: "Offline or imported CRM stage actions confirmed in Google Ads API."
  },
  {
    action_name: "No Gestionado*",
    recommended_bucket: "no_gestionado",
    scope: "BR, CO and any account reusing the same naming",
    reason: "These names represent unmanaged lead states and should stay separate from disqualified outcomes."
  },
  {
    action_name: "No Cualificado, NoUtil_formulario_02",
    recommended_bucket: "no_cualificado",
    scope: "BR, CO and any account reusing the same naming",
    reason: "These names represent disqualified or invalid lead outcomes and should not fall into no_gestionado."
  },
  {
    action_name: "Visita, CIPHER - Visita",
    recommended_bucket: "visita",
    scope: "CO, BR, Cipher",
    reason: "Validated as visit or page-view style actions."
  },
  {
    action_name: "Conversation started, Compra, Purchase, Checkout, Inicio de la tramitacion de la compra",
    recommended_bucket: "ignored",
    scope: "BR, PE historical data, Digital Gold, Change AU",
    reason: "These actions should be ignored in the lead model and excluded from coverage checks."
  }
];

function buildGoogleAdsIgnoredActionSql(columnName) {
  return GOOGLE_ADS_IGNORED_ACTION_NAMES.length
    ? `${columnName} IN (${sqlInList(GOOGLE_ADS_IGNORED_ACTION_NAMES)})`
    : "FALSE";
}

function buildGoogleAdsExcludedFromCoverageSql(columnName) {
  return buildGoogleAdsIgnoredActionSql(columnName);
}

function buildGoogleAdsConversionBucketSql(columnName) {
  return {
    crm: [
      `REGEXP_CONTAINS(${columnName}, r'^(Cualificado|Positivo)(_|$)')`,
      `REGEXP_CONTAINS(${columnName}, r'^Formulario_04($|_)')`
    ].join(" OR "),
    form: `${columnName} IN (${sqlInList(GOOGLE_ADS_FORM_ACTION_NAMES)})`,
    call: `${columnName} IN (${sqlInList(GOOGLE_ADS_CALL_ACTION_NAMES)})`,
    visita: `${columnName} LIKE '%Visita%'`,
    noGestionado: [
      `${columnName} IN (${sqlInList(GOOGLE_ADS_NO_GESTIONADO_ACTION_NAMES)})`,
      `${columnName} LIKE '%No Gestionado%'`,
      `${columnName} LIKE '%NoGestionado%'`
    ].join(" OR "),
    noCualificado: [
      `${columnName} IN (${sqlInList(GOOGLE_ADS_NO_CUALIFICADO_ACTION_NAMES)})`
    ].join(" OR ")
  };
}

// Meta Ads incremental helpers
function parseMetaAccountNames(rawValue) {
  return String(rawValue || "")
    .split("|")
    .map(name => name.trim())
    .filter(Boolean);
}

function buildMetaInListSql(rawValue) {
  return parseMetaAccountNames(rawValue).map(escapeSqlLiteral).join(", ");
}

function buildMetaAccountFilterSql(rawValue, columnName = "account") {
  const allowedAccountsSql = buildMetaInListSql(rawValue);
  return allowedAccountsSql
    ? `AND ${columnName} IN (${allowedAccountsSql})`
    : `AND FALSE -- no Meta account configured for this release config`;
}

function buildMetaDisallowedAccountsSql(rawValue, columnName = "ad_account_name") {
  const allowedAccountsSql = buildMetaInListSql(rawValue);
  return allowedAccountsSql
    ? `${columnName} NOT IN (${allowedAccountsSql})`
    : `TRUE`;
}

function buildMetaIncrementalDateCheckpointSql(
  selfRef,
  rawValue,
  accountColumnName = "ad_account_name",
  dateColumnName = "date"
) {
  const disallowedAccountsSql = buildMetaDisallowedAccountsSql(rawValue, accountColumnName);
  return `
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ${selfRef}
          WHERE ${disallowedAccountsSql}
        ) THEN DATE('2020-01-01')
        ELSE COALESCE(DATE_SUB(MAX(${dateColumnName}), INTERVAL 3 DAY), DATE('2020-01-01'))
      END
    FROM ${selfRef}
  `;
}

function buildUnifiedCampaignMartIncrementalDateCheckpointSql(
  selfRef,
  googleAdsCustomerIdRaw,
  metaAccountNamesRaw
) {
  const googleAdsCustomerId = parseGoogleAdsCustomerId(googleAdsCustomerIdRaw);
  const googleStaleRowsPredicate = googleAdsCustomerId === 0
    ? `platform = 'google_ads' AND account_id IS NOT NULL`
    : `platform = 'google_ads' AND CAST(account_id AS INT64) != CAST(${googleAdsCustomerId} AS INT64)`;
  const metaStaleRowsPredicate = `platform = 'meta_ads' AND (${buildMetaDisallowedAccountsSql(metaAccountNamesRaw, "account_name")})`;

  return `
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ${selfRef}
          WHERE ${googleStaleRowsPredicate}
        ) OR EXISTS (
          SELECT 1
          FROM ${selfRef}
          WHERE ${metaStaleRowsPredicate}
        ) THEN DATE('2020-01-01')
        ELSE COALESCE(DATE_SUB(MAX(date), INTERVAL 3 DAY), DATE('2020-01-01'))
      END
    FROM ${selfRef}
  `;
}

// Meta Ads conversion mapping
const META_ADS_FORM_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.Form",
  "offsite_conversion.fb_pixel_custom.form",
  "offsite_conversion.fb_pixel_custom.Formulario Contacto"
];

const META_ADS_CRM_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.Cualificado"
];

const META_ADS_CONTACT_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.c2c",
  "offsite_conversion.fb_pixel_custom.click to call",
  "offsite_conversion.fb_pixel_custom.click_to_whatsapp"
];

const META_ADS_VISITA_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.Visita"
];

const META_ADS_NO_GESTIONADO_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.No Gestionado"
];

const META_ADS_NO_CUALIFICADO_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.No Cualificado",
  "offsite_conversion.fb_pixel_custom.Cuelga",
  "offsite_conversion.fb_pixel_custom.Telefono Erroneo",
  "offsite_conversion.fb_pixel_custom.Registro Error"
];

const META_ADS_CUALIFICADO_NEGATIVO_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.Cualificado Negativo",
  "offsite_conversion.fb_pixel_custom.Baja Recaudacion"
];

const META_ADS_REVIEW_CONVERSION_NAMES = [
  "offsite_conversion.fb_pixel_custom.Lead_60s/50%",
  "CompleteRegistration"
];

const META_ADS_CONVERSION_AUDIT = [
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.Form, form, Formulario Contacto",
    recommended_bucket: "form",
    scope: "ES, BR, AR, CL, CO, CRI, ECU, MEX, PE, PT, PY, UY, DE",
    reason: "Validated against GTM Meta tags or CAPI tags and raw BigQuery conversion names."
  },
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.CMB/cmb",
    recommended_bucket: "call",
    scope: "ES, BR, AR, CL, CO, CRI, ECU, MEX, PE, PT, PY, UY, DE",
    reason: "Business treats CMB as callback or contact lead."
  },
  {
    conversion_name: "contact_total, contact_website, offsite_conversion.fb_pixel_custom.c2c, offsite_conversion.fb_pixel_custom.click to call, offsite_conversion.fb_pixel_custom.click_to_whatsapp",
    recommended_bucket: "call",
    scope: "ES, BR, AR, CL, CO, CRI, ECU, MEX, PE, PY, UY",
    reason: "Validated as direct contact intent events."
  },
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.Cualificado",
    recommended_bucket: "crm",
    scope: "BR, AR, CO, CRI, MEX, PE, PY",
    reason: "Qualified lead state present in raw Meta export."
  },
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.Visita",
    recommended_bucket: "visita",
    scope: "BR, AR, CL, CO, CRI, MEX, PE",
    reason: "Visit-style event present in BigQuery raw conversions."
  },
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.No Gestionado",
    recommended_bucket: "no_gestionado",
    scope: "BR, AR, CL, CO, CRI, MEX, PE, PY",
    reason: "Unmanaged lead outcomes that should stay separate from qualification outcomes."
  },
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.No Cualificado, Cuelga, Telefono Erroneo, Registro Error",
    recommended_bucket: "no_cualificado",
    scope: "BR, AR, CL, CO, CRI, MEX, PE, PY",
    reason: "Invalid or disqualified lead outcomes that should be tracked separately."
  },
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.Cualificado Negativo, Baja Recaudacion",
    recommended_bucket: "cualificado_negativo",
    scope: "BR, AR, CL, CO, CRI, MEX, PE, PY",
    reason: "Qualified-but-negative lead outcomes that should be kept separate."
  },
  {
    conversion_name: "offsite_conversion.fb_pixel_custom.Lead_60s/50%",
    recommended_bucket: "review",
    scope: "DE",
    reason: "Appears in Meta live event breakdown but was not present in the BigQuery raw conversions during this audit."
  },
  {
    conversion_name: "CompleteRegistration",
    recommended_bucket: "review",
    scope: "CO, PE live Meta events",
    reason: "Visible in live Meta API but not in the BigQuery raw conversion export used by this ETL."
  }
];

function buildMetaAdsExcludedFromCoverageSql(columnName) {
  return META_ADS_REVIEW_CONVERSION_NAMES.length
    ? `${columnName} IN (${sqlInList(META_ADS_REVIEW_CONVERSION_NAMES)})`
    : "FALSE";
}

function buildMetaAdsConversionBucketSql(columnName) {
  return {
    cmb: `LOWER(${columnName}) LIKE '%cmb%'`,
    form: `${columnName} IN (${sqlInList(META_ADS_FORM_CONVERSION_NAMES)})`,
    crm: `${columnName} IN (${sqlInList(META_ADS_CRM_CONVERSION_NAMES)})`,
    contact: `${columnName} IN (${sqlInList(META_ADS_CONTACT_CONVERSION_NAMES)})`,
    visita: `${columnName} IN (${sqlInList(META_ADS_VISITA_CONVERSION_NAMES)})`,
    noGestionado: `${columnName} IN (${sqlInList(META_ADS_NO_GESTIONADO_CONVERSION_NAMES)})`,
    noCualificado: `${columnName} IN (${sqlInList(META_ADS_NO_CUALIFICADO_CONVERSION_NAMES)})`,
    cualificadoNegativo: `${columnName} IN (${sqlInList(META_ADS_CUALIFICADO_NEGATIVO_CONVERSION_NAMES)})`
  };
}

module.exports = {
  buildCountryCodeFromNameSql,
  parseGoogleAdsCustomerId,
  buildGoogleAdsIncrementalDateCheckpointSql,
  buildGoogleAdsConversionBucketSql,
  buildGoogleAdsIgnoredActionSql,
  buildGoogleAdsExcludedFromCoverageSql,
  GOOGLE_ADS_CONVERSION_AUDIT,
  GOOGLE_ADS_IGNORED_ACTION_NAMES,
  parseMetaAccountNames,
  buildMetaAccountFilterSql,
  buildMetaDisallowedAccountsSql,
  buildMetaIncrementalDateCheckpointSql,
  buildUnifiedCampaignMartIncrementalDateCheckpointSql,
  buildMetaAdsConversionBucketSql,
  buildMetaAdsExcludedFromCoverageSql,
  META_ADS_CONVERSION_AUDIT,
  META_ADS_REVIEW_CONVERSION_NAMES
};
