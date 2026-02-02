import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["convex/**/*.test.ts"],
    globals: true,
    // Set ADMIN_SECRET for tests so server-side mutations can validate it
    env: {
      ADMIN_SECRET: "test-admin-secret",
    },
  },
});

