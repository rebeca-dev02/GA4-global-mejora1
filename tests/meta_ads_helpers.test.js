const assert = require("assert");

const {
  parseMetaAccountNames,
  buildMetaAccountFilterSql,
  buildMetaDisallowedAccountsSql,
  buildMetaIncrementalDateCheckpointSql
} = require("../includes/custom/marketing_helpers.js");
const {
  buildMetaAdsConversionBucketSql,
  META_ADS_REVIEW_CONVERSION_NAMES
} = require("../includes/custom/marketing_helpers.js");

assert.deepStrictEqual(
  parseMetaAccountNames(" Prosegur Cash Guatemala | Prosegur Cash Paraguay_refresh "),
  ["Prosegur Cash Guatemala", "Prosegur Cash Paraguay_refresh"]
);

assert.strictEqual(
  buildMetaAccountFilterSql("Prosegur Cash Guatemala", "account"),
  "AND account IN ('Prosegur Cash Guatemala')"
);

assert.strictEqual(
  buildMetaDisallowedAccountsSql("Prosegur Cash Guatemala", "ad_account_name"),
  "ad_account_name NOT IN ('Prosegur Cash Guatemala')"
);

const checkpointSql = buildMetaIncrementalDateCheckpointSql(
  "`project.dataset.src_meta_ads_ad_daily`",
  "Prosegur Cash Guatemala",
  "ad_account_name",
  "date"
);

assert.ok(
  checkpointSql.includes("ad_account_name NOT IN ('Prosegur Cash Guatemala')"),
  "Checkpoint SQL should detect stale historical rows from foreign Meta accounts."
);

assert.ok(
  checkpointSql.includes("THEN DATE('2020-01-01')"),
  "Checkpoint SQL should force a full rebuild when stale Meta accounts are detected."
);

const emptyConfigCheckpointSql = buildMetaIncrementalDateCheckpointSql(
  "`project.dataset.src_meta_ads_ad_daily`",
  "",
  "ad_account_name",
  "date"
);

assert.ok(
  emptyConfigCheckpointSql.includes("WHERE TRUE"),
  "Checkpoint SQL should delete historical rows when the Meta account mapping is cleared."
);

const metaBuckets = buildMetaAdsConversionBucketSql("c.name");

assert.ok(
  metaBuckets.contact.includes("offsite_conversion.fb_pixel_custom.c2c"),
  "Meta contact bucket should include c2c events."
);

assert.ok(
  metaBuckets.contact.includes("offsite_conversion.fb_pixel_custom.click to call"),
  "Meta contact bucket should include click to call events."
);

assert.ok(
  metaBuckets.contact.includes("offsite_conversion.fb_pixel_custom.click_to_whatsapp"),
  "Meta contact bucket should include click_to_whatsapp events."
);

assert.ok(
  metaBuckets.noGestionado.includes("offsite_conversion.fb_pixel_custom.No Gestionado"),
  "Meta no gestionado bucket should keep No Gestionado in the unmanaged bucket."
);

assert.ok(
  metaBuckets.noCualificado.includes("offsite_conversion.fb_pixel_custom.No Cualificado") &&
  metaBuckets.noCualificado.includes("offsite_conversion.fb_pixel_custom.Cuelga"),
  "Meta no_cualificado bucket should include invalid and disqualified lead outcomes."
);

assert.ok(
  metaBuckets.cualificadoNegativo.includes("offsite_conversion.fb_pixel_custom.Cualificado Negativo") &&
  metaBuckets.cualificadoNegativo.includes("offsite_conversion.fb_pixel_custom.Baja Recaudacion"),
  "Meta cualificado_negativo bucket should include negative qualified outcomes."
);

assert.ok(
  metaBuckets.visita.includes("offsite_conversion.fb_pixel_custom.Visita"),
  "Meta visita bucket should include Visita."
);

assert.ok(
  META_ADS_REVIEW_CONVERSION_NAMES.includes("CompleteRegistration"),
  "Meta review exclusions should keep unresolved live-only events out of the mapping assertion."
);

console.log("marketing helpers meta ads regression tests passed");
