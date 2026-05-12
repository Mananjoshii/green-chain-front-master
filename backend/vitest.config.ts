import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/**/*.test.ts"],
    // Run in a single fork to avoid module cache conflicts with vi.mock
    singleFork: true,
  },
});
