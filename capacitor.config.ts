import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cumaworld.game",
  appName: "CUMA WORLD",
  webDir: "dist",
  backgroundColor: "#090b0f",
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
