import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts"],
    globals: true,
    env: {
      // Test-only admin secret for running tests
      ADMIN_SECRET: "test-admin-secret",
    },
  },
});

