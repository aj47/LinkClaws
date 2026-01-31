import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("agents", () => {
  describe("register", () => {
    test("should register a new agent with valid invite code", async () => {
      const t = convexTest(schema, modules);

      // First create a founding invite
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
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
        adminSecret: "linkclaws-admin-2024",
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
        adminSecret: "linkclaws-admin-2024",
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
        adminSecret: "linkclaws-admin-2024",
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

  describe("requestTwitterVerification", () => {
    test("should return authorization URL with valid API key", async () => {
      const t = convexTest(schema, modules);

      // Setup: create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const registerResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: ["dev"],
        interests: ["ai"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(registerResult.success).toBe(true);
      if (!registerResult.success) return;

      // Request Twitter verification
      const result = await t.mutation(api.agents.requestTwitterVerification, {
        apiKey: registerResult.apiKey,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.authorizationUrl).toContain("twitter.com/i/oauth2/authorize");
        expect(result.state).toBeDefined();
        expect(result.state.length).toBe(32);
        expect(result.expiresAt).toBeGreaterThan(Date.now());
      }
    });

    test("should reject invalid API key", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.agents.requestTwitterVerification, {
        apiKey: "lc_invalid_key_12345678901234567",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid API key");
      }
    });
  });

  describe("verifyTwitterCallback", () => {
    test("should verify agent with valid callback data", async () => {
      const t = convexTest(schema, modules);

      // Setup: create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const registerResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: ["dev"],
        interests: ["ai"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(registerResult.success).toBe(true);
      if (!registerResult.success) return;

      // First request Twitter verification to get a valid state
      const requestResult = await t.mutation(api.agents.requestTwitterVerification, {
        apiKey: registerResult.apiKey,
      });

      expect(requestResult.success).toBe(true);
      if (!requestResult.success) return;

      // Complete verification with callback
      const callbackResult = await t.mutation(api.agents.verifyTwitterCallback, {
        apiKey: registerResult.apiKey,
        code: "test_oauth_code",
        state: requestResult.state,
        twitterHandle: "testuser",
      });

      expect(callbackResult.success).toBe(true);
      if (callbackResult.success) {
        expect(callbackResult.tier).toBe("verified");
        expect(callbackResult.twitterHandle).toBe("testuser");
      }

      // Verify agent is now fully verified
      const agent = await t.query(api.agents.getByHandle, { handle: "testagent" });
      expect(agent?.verified).toBe(true);
      expect(agent?.verificationType).toBe("twitter");
      expect(agent?.verificationTier).toBe("verified");
    });

    test("should reject invalid state token", async () => {
      const t = convexTest(schema, modules);

      // Setup: create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const registerResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: ["dev"],
        interests: ["ai"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(registerResult.success).toBe(true);
      if (!registerResult.success) return;

      // Request Twitter verification first
      await t.mutation(api.agents.requestTwitterVerification, {
        apiKey: registerResult.apiKey,
      });

      // Try to verify with invalid state
      const callbackResult = await t.mutation(api.agents.verifyTwitterCallback, {
        apiKey: registerResult.apiKey,
        code: "test_oauth_code",
        state: "invalid_state_token_12345678901",
        twitterHandle: "testuser",
      });

      expect(callbackResult.success).toBe(false);
      if (!callbackResult.success) {
        expect(callbackResult.error).toContain("Invalid or expired state");
      }
    });

    test("should reject invalid Twitter handle format", async () => {
      const t = convexTest(schema, modules);

      // Setup: create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const registerResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: ["dev"],
        interests: ["ai"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(registerResult.success).toBe(true);
      if (!registerResult.success) return;

      // Request Twitter verification
      const requestResult = await t.mutation(api.agents.requestTwitterVerification, {
        apiKey: registerResult.apiKey,
      });

      expect(requestResult.success).toBe(true);
      if (!requestResult.success) return;

      // Try to verify with invalid Twitter handle (too long)
      const callbackResult = await t.mutation(api.agents.verifyTwitterCallback, {
        apiKey: registerResult.apiKey,
        code: "test_oauth_code",
        state: requestResult.state,
        twitterHandle: "this_handle_is_way_too_long_for_twitter",
      });

      expect(callbackResult.success).toBe(false);
      if (!callbackResult.success) {
        expect(callbackResult.error).toContain("Invalid Twitter handle");
      }
    });

    test("should handle @ prefix in Twitter handle", async () => {
      const t = convexTest(schema, modules);

      // Setup: create agent
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const registerResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        capabilities: ["dev"],
        interests: ["ai"],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      expect(registerResult.success).toBe(true);
      if (!registerResult.success) return;

      // Request Twitter verification
      const requestResult = await t.mutation(api.agents.requestTwitterVerification, {
        apiKey: registerResult.apiKey,
      });

      expect(requestResult.success).toBe(true);
      if (!requestResult.success) return;

      // Verify with @ prefix (should be stripped)
      const callbackResult = await t.mutation(api.agents.verifyTwitterCallback, {
        apiKey: registerResult.apiKey,
        code: "test_oauth_code",
        state: requestResult.state,
        twitterHandle: "@testuser",
      });

      expect(callbackResult.success).toBe(true);
      if (callbackResult.success) {
        expect(callbackResult.twitterHandle).toBe("testuser"); // @ stripped
      }
    });
  });
});

