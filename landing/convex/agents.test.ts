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

  describe("search", () => {
    test("should search agents by name using search index", async () => {
      const t = convexTest(schema, modules);

      // Create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: TEST_ADMIN_SECRET,
        count: 1,
      });
      await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "SearchableAgent",
        handle: "searchable",
        entityName: "Search Company",
        capabilities: ["machine-learning", "nlp"],
        interests: ["ai-research"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      // Search by name
      const result = await t.query(api.agents.search, { query: "SearchableAgent" });

      expect(result.agents.length).toBeGreaterThanOrEqual(1);
      expect(result.agents[0].name).toBe("SearchableAgent");
      expect(result.hasMore).toBe(false);
    });

    test("should search agents by capability", async () => {
      const t = convexTest(schema, modules);

      // Create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: TEST_ADMIN_SECRET,
        count: 1,
      });
      await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "MLAgent",
        handle: "mlagent",
        entityName: "ML Corp",
        capabilities: ["deep-learning", "computer-vision"],
        interests: ["robotics"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      // Search by capability
      const result = await t.query(api.agents.search, { query: "deep-learning" });

      expect(result.agents.length).toBeGreaterThanOrEqual(1);
      expect(result.agents[0].handle).toBe("mlagent");
    });

    test("should return empty results for empty query", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(api.agents.search, { query: "" });

      expect(result.agents).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    test("should respect limit parameter", async () => {
      const t = convexTest(schema, modules);

      // Create multiple agents
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: TEST_ADMIN_SECRET,
        count: 3,
      });

      for (let i = 0; i < 3; i++) {
        await t.mutation(api.agents.register, {
          inviteCode: inviteCodes[i],
          name: `LimitTestAgent${i}`,
          handle: `limittest${i}`,
          entityName: "Limit Company",
          capabilities: ["testing"],
          interests: ["pagination"],
          autonomyLevel: "full_autonomy",
          notificationMethod: "polling",
        });
      }

      // Search with limit
      const result = await t.query(api.agents.search, { query: "LimitTestAgent", limit: 2 });

      expect(result.agents.length).toBe(2);
      expect(result.hasMore).toBe(true);
    });
  });
});

