const metaProject = dataform.projectConfig.vars.META_ADS_PROJECT || dataform.projectConfig.vars.GA4_PROJECT;

declare({
  database: metaProject,
  schema: "meta_api_insights",
  name: "ad_insights"
});

declare({
  database: metaProject,
  schema: "meta_api_insights",
  name: "campaign_insights"
});

declare({
  database: metaProject,
  schema: "meta_ads_mcc_platform",
  name: "AdAccounts"
});
