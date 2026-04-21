const assert = require("assert");

const {
  parseGoogleAdsCustomerId,
  buildGoogleAdsIncrementalDateCheckpointSql,
  buildUnifiedCampaignMartIncrementalDateCheckpointSql
} = require("../includes/custom/marketing_helpers.js");
const {
  buildGoogleAdsConversionBucketSql,
  buildGoogleAdsIgnoredActionSql,
  GOOGLE_ADS_IGNORED_ACTION_NAMES
} = require("../includes/custom/marketing_helpers.js");

assert.strictEqual(parseGoogleAdsCustomerId("0"), 0);
assert.strictEqual(parseGoogleAdsCustomerId("1703013237"), 1703013237);
assert.strictEqual(parseGoogleAdsCustomerId("not-a-number"), 0);

const checkpointSqlWhenDisabled = buildGoogleAdsIncrementalDateCheckpointSql(
  "`project.dataset.some_table`",
  "0",
  "customer_id",
  "date"
);

assert.ok(
  checkpointSqlWhenDisabled.includes("customer_id IS NOT NULL"),
  "When Google Ads is disabled, any persisted customer_id should trigger a full rebuild."
);

assert.ok(
  checkpointSqlWhenDisabled.includes("THEN DATE('2020-01-01')"),
  "Google incremental checkpoint should force a full rebuild when stale customer rows are detected."
);

const campaignCheckpointSql = buildUnifiedCampaignMartIncrementalDateCheckpointSql(
  "`project.dataset.campaign_mart`",
  "1703013237",
  "Meta Account 1|Meta Account 2"
);

assert.ok(
  campaignCheckpointSql.includes("platform = 'google_ads'"),
  "Campaign mart checkpoint should evaluate stale Google Ads rows."
);

assert.ok(
  campaignCheckpointSql.includes("platform = 'meta_ads'"),
  "Campaign mart checkpoint should evaluate stale Meta Ads rows."
);

const duplicatedByKeywordText = [
  { date: "2023-03-30", customer_id: 1703013237, campaign_id: 11354746448, ad_group_id: 121680257198, criterion_id: 418975308676, keyword_text: "sistema de cobro automático" },
  { date: "2023-03-30", customer_id: 1703013237, campaign_id: 11354746448, ad_group_id: 121680257198, criterion_id: 442046801747, keyword_text: "sistema de cobro automático" },
  { date: "2023-03-30", customer_id: 1703013237, campaign_id: 11354746448, ad_group_id: 121680257198, criterion_id: 518261843938, keyword_text: "sistema de cobro automático" }
];

const oldGrouping = new Map();
for (const row of duplicatedByKeywordText) {
  const key = [row.date, row.customer_id, row.campaign_id, row.ad_group_id, row.keyword_text].join("|");
  oldGrouping.set(key, (oldGrouping.get(key) || 0) + 1);
}
assert.ok(
  [...oldGrouping.values()].some(count => count > 1),
  "The old assertion grain by keyword_text reproduces the false positive."
);

const correctedGrouping = new Map();
for (const row of duplicatedByKeywordText) {
  const matchType = row.criterion_id === 418975308676
    ? "EXACT"
    : row.criterion_id === 442046801747
      ? "BROAD"
      : "PHRASE";
  const key = [row.date, row.customer_id, row.campaign_id, row.ad_group_id, row.keyword_text, matchType].join("|");
  correctedGrouping.set(key, (correctedGrouping.get(key) || 0) + 1);
}
assert.ok(
  [...correctedGrouping.values()].every(count => count === 1),
  "The corrected assertion grain by keyword_text + match_type avoids the false positive."
);

const bucketSql = buildGoogleAdsConversionBucketSql("action_name");
const ignoredActionSql = buildGoogleAdsIgnoredActionSql("action_name");

assert.ok(
  bucketSql.crm.includes("^(Cualificado|Positivo)(_|$)"),
  "CRM mapping should anchor the Cualificado/Positivo family and avoid false positives like 'No Cualificado'."
);

assert.ok(
  bucketSql.crm.includes("^Formulario_04($|_)"),
  "CRM mapping should cover Formulario_04 variants such as _PAY."
);

assert.ok(
  bucketSql.form.includes("Lead Submit") &&
  bucketSql.form.includes("Prosegur Paraguay - GA4 (web) generate_lead"),
  "Form mapping should include the audited Lead Submit and Paraguay GA4 generate_lead actions."
);

assert.ok(
  bucketSql.call.includes("Prosegur Paraguay - GA4 (web) c2c") &&
  bucketSql.call.includes("CMB"),
  "Call mapping should include both callback-style CMB actions and the Paraguay GA4 c2c action."
);

assert.ok(
  bucketSql.noGestionado.includes("No Gestionado_formulario") &&
  !bucketSql.noGestionado.includes("No Cualificado"),
  "No Gestionado actions should stay isolated from disqualified outcomes."
);

assert.ok(
  bucketSql.noCualificado.includes("No Cualificado") &&
  bucketSql.noCualificado.includes("NoUtil_formulario_02"),
  "Disqualified Google Ads lead states should map to no_cualificado."
);

assert.ok(
  GOOGLE_ADS_IGNORED_ACTION_NAMES.includes("Conversation started"),
  "Ignored Google Ads actions should keep Conversation started outside the hard buckets."
);

assert.ok(
  GOOGLE_ADS_IGNORED_ACTION_NAMES.includes("Purchase"),
  "Ignored Google Ads actions should keep ecommerce actions out of the lead mapping assertion."
);

assert.ok(
  ignoredActionSql.includes("Conversation started") &&
  ignoredActionSql.includes("Purchase"),
  "Ignored Google Ads actions should be reusable in SQL to exclude them from downstream conversion totals."
);

console.log("marketing helpers google ads regression tests passed");
