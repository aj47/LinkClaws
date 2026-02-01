import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const TEST_ADMIN_SECRET = "test-admin-secret";
process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;

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

  describe("API key management", () => {
    test("should create a new API key", async () => {
      const t = convexTest(schema, modules);

      // Create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const regResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Key Test Agent",
        handle: "keytestagent",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!regResult.success) throw new Error("Failed to create agent");

      // Create a new API key
      const createResult = await t.mutation(api.agents.createApiKey, {
        apiKey: regResult.apiKey,
        name: "production",
      });

      expect(createResult.success).toBe(true);
      if (createResult.success) {
        expect(createResult.apiKey).toMatch(/^lc_/);
        expect(createResult.keyPrefix).toMatch(/^lc_/);
        expect(createResult.keyId).toBeDefined();
      }
    });

    test("should list API keys", async () => {
      const t = convexTest(schema, modules);

      // Create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const regResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "List Keys Agent",
        handle: "listkeysagent",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!regResult.success) throw new Error("Failed to create agent");

      // Create two API keys
      await t.mutation(api.agents.createApiKey, {
        apiKey: regResult.apiKey,
        name: "key1",
      });
      await t.mutation(api.agents.createApiKey, {
        apiKey: regResult.apiKey,
        name: "key2",
      });

      // List keys
      const keys = await t.query(api.agents.listApiKeys, {
        apiKey: regResult.apiKey,
      });

      expect(keys.length).toBe(2);
      expect(keys.every(k => k.isActive)).toBe(true);
      expect(keys.some(k => k.name === "key1")).toBe(true);
      expect(keys.some(k => k.name === "key2")).toBe(true);
    });

    test("should revoke an API key", async () => {
      const t = convexTest(schema, modules);

      // Create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const regResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Revoke Key Agent",
        handle: "revokekeyagent",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!regResult.success) throw new Error("Failed to create agent");

      // Create a new key
      const createResult = await t.mutation(api.agents.createApiKey, {
        apiKey: regResult.apiKey,
        name: "to-revoke",
      });

      if (!createResult.success) throw new Error("Failed to create key");

      // Revoke the new key using the original key
      const revokeResult = await t.mutation(api.agents.revokeApiKey, {
        apiKey: regResult.apiKey,
        keyId: createResult.keyId,
        reason: "Testing revocation",
      });

      expect(revokeResult.success).toBe(true);

      // Verify key is revoked
      const keys = await t.query(api.agents.listApiKeys, {
        apiKey: regResult.apiKey,
      });
      const revokedKey = keys.find(k => k._id === createResult.keyId);
      expect(revokedKey?.isActive).toBe(false);
      expect(revokedKey?.revokedReason).toBe("Testing revocation");
    });

    test("should not allow revoking the current auth key", async () => {
      const t = convexTest(schema, modules);

      // Create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const regResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Self Revoke Agent",
        handle: "selfrevokeagent",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!regResult.success) throw new Error("Failed to create agent");

      // Create a new key and use it
      const createResult = await t.mutation(api.agents.createApiKey, {
        apiKey: regResult.apiKey,
        name: "new-key",
      });

      if (!createResult.success) throw new Error("Failed to create key");

      // Try to revoke the key we're using for auth
      const revokeResult = await t.mutation(api.agents.revokeApiKey, {
        apiKey: createResult.apiKey,
        keyId: createResult.keyId,
      });

      expect(revokeResult.success).toBe(false);
      if (!revokeResult.success) {
        expect(revokeResult.error).toContain("currently using");
      }
    });

    test("should enforce maximum 5 active keys", async () => {
      const t = convexTest(schema, modules);

      // Create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const regResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Max Keys Agent",
        handle: "maxkeysagent",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!regResult.success) throw new Error("Failed to create agent");

      // Create 5 keys (max allowed)
      for (let i = 0; i < 5; i++) {
        const result = await t.mutation(api.agents.createApiKey, {
          apiKey: regResult.apiKey,
          name: `key${i}`,
        });
        expect(result.success).toBe(true);
      }

      // Try to create a 6th key
      const sixthResult = await t.mutation(api.agents.createApiKey, {
        apiKey: regResult.apiKey,
        name: "key6",
      });

      expect(sixthResult.success).toBe(false);
      if (!sixthResult.success) {
        expect(sixthResult.error).toContain("Maximum 5");
      }
    });
  });
});

