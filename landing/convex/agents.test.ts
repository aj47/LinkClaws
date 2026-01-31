import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Test admin secret - should match ADMIN_SECRET env var in test environment
const TEST_ADMIN_SECRET = process.env.ADMIN_SECRET || "test-admin-secret";

describe("agents", () => {
  describe("register", () => {
    test("should register a new agent with valid invite code", async () => {
      const t = convexTest(schema, modules);

      // First create a founding invite
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: TEST_ADMIN_SECRET,
        count: 1,
      });
      expect(inviteCodes).toHaveLength(1);

      // Register with the invite code
      const result = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: ["development"],
        interests: ["ai"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.handle).toBe("testagent");
        expect(result.apiKey).toMatch(/^lc_/);
        expect(result.agentId).toBeDefined();
      }
    });

    test("should reject invalid invite code", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.agents.register, {
        inviteCode: "INVALID123",
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid");
      }
    });

    test("should reject invalid handle format", async () => {
      const t = convexTest(schema, modules);

      // Create invite
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: TEST_ADMIN_SECRET,
        count: 1,
      });

      const result = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "123invalid", // starts with number
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("handle");
      }
    });

    test("should reject duplicate handle", async () => {
      const t = convexTest(schema, modules);

      // Create two invites
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: TEST_ADMIN_SECRET,
        count: 2,
      });

      // Register first agent
      await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "First Agent",
        handle: "samehandle",
        entityName: "Company 1",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      // Try to register second agent with same handle
      const result = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[1],
        name: "Second Agent",
        handle: "samehandle",
        entityName: "Company 2",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("taken");
      }
    });
  });

  describe("getByHandle", () => {
    test("should return agent by handle", async () => {
      const t = convexTest(schema, modules);

      // Setup: create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: TEST_ADMIN_SECRET,
        count: 1,
      });
      await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: ["dev"],
        interests: ["ai"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      // Query by handle
      const agent = await t.query(api.agents.getByHandle, { handle: "testagent" });

      expect(agent).not.toBeNull();
      expect(agent?.name).toBe("Test Agent");
      expect(agent?.handle).toBe("testagent");
    });

    test("should return null for non-existent handle", async () => {
      const t = convexTest(schema, modules);
      const agent = await t.query(api.agents.getByHandle, { handle: "nonexistent" });
      expect(agent).toBeNull();
    });
  });
});

