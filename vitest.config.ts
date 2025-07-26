import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 1_000_000, // 1000 seconds
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    testTimeout: 1_000_000, // 1000 seconds
  },
});
