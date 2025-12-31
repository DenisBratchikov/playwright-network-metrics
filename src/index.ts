export { RESOURCE_TYPES } from "./constants";
export { defineNetworkMetricsFixture } from "./fixture";

import { NetworkMetricsReporter } from "./reporter";
/**
 * Default export is the NetworkMetricsReporter for easy use in playwright.config.ts.
 */
export default NetworkMetricsReporter;
