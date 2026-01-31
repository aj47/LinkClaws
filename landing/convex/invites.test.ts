import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper to create a verified agent
async function createVerifiedAgent(t: ReturnType<typeof convexTest>, handle: string) {
  const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
    adminSecret: process.env.ADMIN_SECRET!,
    count: 1,
  });

  const result = await t.mutation(api.agents.register, {
    inviteCode: inviteCodes[0],
    name: `Agent ${handle}`,
    handle,
    entityName: "Test Company",
    capabilities: [],
    interests: [],
    autonomyLevel: "full_autonomy",
    notificationMethod: "poll",
  });

  if (!result.success) throw new Error("Failed to create agent");

  await t.mutation(api.agents.verify, {
    agentId: result.agentId,
    verificationType: "domain",
    verificationData: "test@example.com",
  });

  return { agentId: result.agentId, apiKey: result.apiKey };
}

describe("invites", () => {
  describe("createFoundingInvite", () => {
    test("should create founding invites with admin secret", async () => {
      const t = convexTest(schema, modules);

      const codes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: process.env.ADMIN_SECRET!,
        count: 3,
      });

      expect(codes).toHaveLength(3);
      codes.forEach((code) => {
        expect(code).toHaveLength(8);
      });
    });
  });

  describe("validate", () => {
    test("should validate a valid invite code", async () => {
      const t = convexTest(schema, modules);

      const codes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: process.env.ADMIN_SECRET!,
        count: 1,
      });

      const result = await t.query(api.invites.validate, { code: codes[0] });

      expect(result.valid).toBe(true);
    });

    test("should reject invalid invite code", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(api.invites.validate, { code: "INVALID1" });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should reject used invite code", async () => {
      const t = convexTest(schema, modules);

      // Create and use an invite
      const codes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: process.env.ADMIN_SECRET!,
        count: 1,
      });

      await t.mutation(api.agents.register, {
        inviteCode: codes[0],
        name: "Test Agent",
        handle: "usedcode",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "poll",
      });

      // Try to validate the used code
      const result = await t.query(api.invites.validate, { code: codes[0] });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("used");
    });
  });

  describe("generate", () => {
    test("should generate invite code for verified agent with permission", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "inviter");

      const result = await t.mutation(api.invites.generate, { apiKey });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.code).toHaveLength(8);
      }
    });
  });

  describe("getMyCodes", () => {
    test("should return agent's invite codes", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "mycodegetter");

      // Generate a code
      await t.mutation(api.invites.generate, { apiKey });

      // Get codes
      const codes = await t.query(api.invites.getMyCodes, { apiKey });

      expect(codes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getStats", () => {
    test("should return invite statistics", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "statsgetter");

      const stats = await t.query(api.invites.getStats, { apiKey });

      expect(stats).toHaveProperty("remaining");
      expect(stats).toHaveProperty("generated");
      expect(stats).toHaveProperty("used");
      expect(stats).toHaveProperty("canInvite");
    });
  });
});

