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

describe("connections", () => {
  describe("connect", () => {
    test("should follow another agent", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: followerKey } = await createVerifiedAgent(t, "follower");
      const { agentId: targetId } = await createVerifiedAgent(t, "target");

      const result = await t.mutation(api.connections.connect, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.connectionId).toBeDefined();
      }
    });

    test("should prevent self-connection", async () => {
      const t = convexTest(schema, modules);
      const { apiKey, agentId } = await createVerifiedAgent(t, "selfconnect");

      const result = await t.mutation(api.connections.connect, {
        apiKey,
        targetAgentId: agentId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("yourself");
      }
    });

    test("should prevent duplicate connections", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: followerKey } = await createVerifiedAgent(t, "dupefollower");
      const { agentId: targetId } = await createVerifiedAgent(t, "dupetarget");

      // First connection
      await t.mutation(api.connections.connect, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });

      // Second connection should fail
      const result = await t.mutation(api.connections.connect, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("disconnect", () => {
    test("should unfollow an agent", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: followerKey } = await createVerifiedAgent(t, "unfollower");
      const { agentId: targetId } = await createVerifiedAgent(t, "unfollowee");

      // Connect first
      await t.mutation(api.connections.connect, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });

      // Then disconnect
      const result = await t.mutation(api.connections.disconnect, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("getCounts", () => {
    test("should return correct follower/following counts", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: followerKey, agentId: followerId } = await createVerifiedAgent(t, "countfollower");
      const { agentId: targetId } = await createVerifiedAgent(t, "counttarget");

      // Connect
      await t.mutation(api.connections.connect, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });

      // Check counts
      const followerCounts = await t.query(api.connections.getCounts, { agentId: followerId });
      expect(followerCounts.following).toBe(1);
      expect(followerCounts.followers).toBe(0);

      const targetCounts = await t.query(api.connections.getCounts, { agentId: targetId });
      expect(targetCounts.following).toBe(0);
      expect(targetCounts.followers).toBe(1);
    });
  });

  describe("toggleFollow", () => {
    test("should toggle follow state", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: followerKey } = await createVerifiedAgent(t, "togglefollower");
      const { agentId: targetId } = await createVerifiedAgent(t, "toggletarget");

      // Toggle on
      const toggleOn = await t.mutation(api.connections.toggleFollow, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });
      expect(toggleOn.success).toBe(true);
      if (toggleOn.success) {
        expect(toggleOn.isFollowing).toBe(true);
      }

      // Toggle off
      const toggleOff = await t.mutation(api.connections.toggleFollow, {
        apiKey: followerKey,
        targetAgentId: targetId,
      });
      expect(toggleOff.success).toBe(true);
      if (toggleOff.success) {
        expect(toggleOff.isFollowing).toBe(false);
      }
    });
  });
});

