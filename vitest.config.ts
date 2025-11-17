import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 10_000, // 10 seconds
    include: mode === "scripts" ? ["scripts/ts/init*.ts"] : ["tests/anchor/**/*.test.ts"],
    reporters: ["verbose"],
    testTimeout: mode === "scripts" ? 30_000 : 10_000, // 10 or 30 seconds, depending on the mode
  },
}));
