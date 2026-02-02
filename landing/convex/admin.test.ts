import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const TEST_ADMIN_SECRET = "test-admin-secret";
process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;

const modules = import.meta.glob("./**/*.ts");

// Helper to create a verified agent
async function createVerifiedAgent(t: ReturnType<typeof convexTest>, handle: string) {
  const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
    adminSecret: TEST_ADMIN_SECRET,
    count: 1,
  });

  const result = await t.mutation(api.agents.register, {
    inviteCode: inviteCodes[0],
    name: `Agent ${handle}`,
    handle,
    entityName: "Test Company",
    capabilities: ["testing"],
    interests: ["ai"],
    autonomyLevel: "full_autonomy",
    notificationMethod: "polling",
  });

  if (!result.success) throw new Error("Failed to create agent");
  return { apiKey: result.apiKey, agentId: result.agentId };
}

describe("admin", () => {
  describe("listAgents", () => {
    test("should list all agents", async () => {
      const t = convexTest(schema, modules);
      await createVerifiedAgent(t, "adminlist1");
      await createVerifiedAgent(t, "adminlist2");

      const agents = await t.query(api.admin.listAgents, { limit: 10 });

      expect(agents.length).toBeGreaterThanOrEqual(2);
    });

    test("should filter verified agents only", async () => {
      const t = convexTest(schema, modules);
      const { agentId } = await createVerifiedAgent(t, "adminverify");

      // Verify the agent
      await t.mutation(api.admin.verifyAgent, { agentId });

      const agents = await t.query(api.admin.listAgents, { verifiedOnly: true });

      expect(agents.every(a => a.verified)).toBe(true);
    });
  });

  describe("verifyAgent", () => {
    test("should verify an agent", async () => {
      const t = convexTest(schema, modules);
      const { agentId } = await createVerifiedAgent(t, "adminverifytest");

      const result = await t.mutation(api.admin.verifyAgent, { agentId });

      expect(result.success).toBe(true);

      // Verify it worked
      const agent = await t.query(api.agents.getById, { agentId });
      expect(agent?.verified).toBe(true);
    });
  });

  describe("suspendAgent", () => {
    test("should suspend an agent", async () => {
      const t = convexTest(schema, modules);
      const { agentId } = await createVerifiedAgent(t, "adminsuspend");

      const result = await t.mutation(api.admin.suspendAgent, {
        agentId,
        reason: "Test suspension",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("getSystemStats", () => {
    test("should return system statistics", async () => {
      const t = convexTest(schema, modules);
      await createVerifiedAgent(t, "adminstats");

      const stats = await t.query(api.admin.getSystemStats, {});

      expect(stats.totalAgents).toBeGreaterThanOrEqual(1);
      expect(stats.totalPosts).toBeDefined();
      expect(stats.totalConnections).toBeDefined();
      expect(stats.totalMessages).toBeDefined();
    });
  });

  describe("listPosts", () => {
    test.skip("should list posts for moderation", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "adminposts");

      // Create a post
      const post = await t.mutation(api.posts.create, {
        apiKey,
        type: "announcement",
        content: "Test post for moderation",
      });
      
      expect(post.success).toBe(true);

      const posts = await t.query(api.admin.listPosts, { limit: 10 });

      expect(posts.length).toBeGreaterThanOrEqual(1);
      expect(posts[0].content).toBeDefined();
    });
  });

  describe("moderatePost", () => {
    test.skip("should hide a post", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "adminmod");

      const post = await t.mutation(api.posts.create, {
        apiKey,
        type: "announcement",
        content: "Post to hide",
      });

      const result = await t.mutation(api.admin.moderatePost, {
        postId: post.postId,
        action: "hide",
        reason: "Test moderation",
      });

      expect(result.success).toBe(true);
    });
  });
});
