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

describe("endorsements", () => {
  describe("give", () => {
    test("should give an endorsement", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: giverKey } = await createVerifiedAgent(t, "endorser");
      const { agentId: receiverId } = await createVerifiedAgent(t, "endorsed");

      const result = await t.mutation(api.endorsements.give, {
        apiKey: giverKey,
        targetAgentId: receiverId,
        reason: "Great work on the AI project! Highly recommend.",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.endorsementId).toBeDefined();
      }
    });

    test("should prevent self-endorsement", async () => {
      const t = convexTest(schema, modules);
      const { apiKey, agentId } = await createVerifiedAgent(t, "selfendorser");

      const result = await t.mutation(api.endorsements.give, {
        apiKey,
        targetAgentId: agentId,
        reason: "I'm the best!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("yourself");
      }
    });

    test("should prevent duplicate endorsements", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: giverKey } = await createVerifiedAgent(t, "dupeendorser");
      const { agentId: receiverId } = await createVerifiedAgent(t, "dupeendorsed");

      // First endorsement
      await t.mutation(api.endorsements.give, {
        apiKey: giverKey,
        targetAgentId: receiverId,
        reason: "First endorsement reason here.",
      });

      // Second endorsement should fail
      const result = await t.mutation(api.endorsements.give, {
        apiKey: giverKey,
        targetAgentId: receiverId,
        reason: "Second endorsement reason here.",
      });

      expect(result.success).toBe(false);
    });

    test("should reject short reason", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: giverKey } = await createVerifiedAgent(t, "shortendorser");
      const { agentId: receiverId } = await createVerifiedAgent(t, "shortendorsed");

      const result = await t.mutation(api.endorsements.give, {
        apiKey: giverKey,
        targetAgentId: receiverId,
        reason: "Short", // Less than 10 chars
      });

      expect(result.success).toBe(false);
    });
  });

  describe("getReceived", () => {
    test("should return endorsements received", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: giverKey } = await createVerifiedAgent(t, "getendorser");
      const { agentId: receiverId } = await createVerifiedAgent(t, "getendorsed");

      // Give endorsement
      await t.mutation(api.endorsements.give, {
        apiKey: giverKey,
        targetAgentId: receiverId,
        reason: "Excellent collaboration skills!",
      });

      // Get received endorsements
      const endorsements = await t.query(api.endorsements.getReceived, {
        agentId: receiverId,
        limit: 10,
      });

      expect(endorsements.length).toBe(1);
      expect(endorsements[0].reason).toBe("Excellent collaboration skills!");
    });
  });

  describe("getCount", () => {
    test("should return correct endorsement count", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: giver1Key } = await createVerifiedAgent(t, "countgiver1");
      const { apiKey: giver2Key } = await createVerifiedAgent(t, "countgiver2");
      const { agentId: receiverId } = await createVerifiedAgent(t, "countreceiver");

      // Give two endorsements
      await t.mutation(api.endorsements.give, {
        apiKey: giver1Key,
        targetAgentId: receiverId,
        reason: "First endorsement for count test.",
      });
      await t.mutation(api.endorsements.give, {
        apiKey: giver2Key,
        targetAgentId: receiverId,
        reason: "Second endorsement for count test.",
      });

      const count = await t.query(api.endorsements.getCount, { agentId: receiverId });
      expect(count).toBe(2);
    });
  });
});

