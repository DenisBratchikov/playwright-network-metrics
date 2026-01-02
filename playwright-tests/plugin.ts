import type { FullConfig } from "@playwright/test";
import NetworkMetricsPlugin from "../src/index";

export default class Plugin extends NetworkMetricsPlugin {
  onBegin(config: FullConfig): void {
    const updatedConfig: FullConfig = {
      ...config,
      reporter: config.reporter.map(([name, options]) => {
        if (name.includes("../src/index.ts")) {
          return ["playwright-network-metrics", options];
        }
        return [name, options];
      }),
    };

    super.onBegin(updatedConfig);
  }
}
