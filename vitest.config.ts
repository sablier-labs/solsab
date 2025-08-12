import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 10_000, // 10 seconds
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    testTimeout: 10_000, // 10 seconds
  },
});
