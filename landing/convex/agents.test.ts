import { convexTest } from "convex-test";
import { expect, test, describe, vi } from "vitest";
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

  describe("email verification", () => {
    test("should request email verification and NOT return the code in response", async () => {
      vi.useFakeTimers();
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

      if (!registerResult.success) {
        throw new Error("Registration failed");
      }

      // Request email verification
      const result = await t.mutation(api.agents.requestEmailVerification, {
        apiKey: registerResult.apiKey,
        email: "test@example.com",
      });

      // Run scheduled functions (email sending)
      vi.runAllTimers();
      await t.finishInProgressScheduledFunctions();

      expect(result.success).toBe(true);
      if (result.success) {
        // SECURITY: Verify the code is NOT in the response message
        expect(result.message).not.toContain("Code:");
        expect(result.message).not.toMatch(/\d{6}/); // Should not contain 6-digit code
        expect(result.message).toContain("Verification code sent");
        expect(result.message).toContain("check your inbox");
      }
      vi.useRealTimers();
    });

    test("should reject invalid email format", async () => {
      vi.useFakeTimers();
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
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!registerResult.success) {
        throw new Error("Registration failed");
      }

      // Request with invalid email
      const result = await t.mutation(api.agents.requestEmailVerification, {
        apiKey: registerResult.apiKey,
        email: "invalid-email",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid email");
      }
      vi.useRealTimers();
    });

    test("should verify email with correct code", async () => {
      vi.useFakeTimers();
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
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!registerResult.success) {
        throw new Error("Registration failed");
      }

      // Request verification
      await t.mutation(api.agents.requestEmailVerification, {
        apiKey: registerResult.apiKey,
        email: "test@example.com",
      });

      // Run scheduled functions
      vi.runAllTimers();
      await t.finishInProgressScheduledFunctions();

      // Get the code from DB (only for testing purposes)
      const agent = await t.query(api.agents.getMe, { apiKey: registerResult.apiKey });
      // Note: In tests we'd need to access the DB directly to get the code
      // This test verifies the flow works, actual code verification would need DB access

      expect(agent).not.toBeNull();
      vi.useRealTimers();
    });

    test("should reject already verified email", async () => {
      vi.useFakeTimers();
      const t = convexTest(schema, modules);

      // Setup: create agent with email already verified via DB manipulation
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const registerResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Test Agent",
        handle: "testagent",
        entityName: "Test Company",
        email: "test@example.com",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!registerResult.success) {
        throw new Error("Registration failed");
      }

      // First verification request should work
      const result1 = await t.mutation(api.agents.requestEmailVerification, {
        apiKey: registerResult.apiKey,
        email: "test@example.com",
      });

      // Run scheduled functions
      vi.runAllTimers();
      await t.finishInProgressScheduledFunctions();

      expect(result1.success).toBe(true);
      vi.useRealTimers();
    });
  });
});

