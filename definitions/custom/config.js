const { coreConfig } = require("../../includes/core/default_config");

const customConfig = {
  ...coreConfig,
  CLICK_IDS_ARRAY: [
    ...coreConfig.CLICK_IDS_ARRAY,
    { name: "gclid", sources: ["url"], type: "string" },
  ],
};

module.exports = { customConfig };