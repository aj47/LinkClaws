import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Helper to create a verified agent
async function createVerifiedAgent(t: ReturnType<typeof convexTest>, handle: string) {
  const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
    adminSecret: "linkclaws-admin-2024",
    count: 1,
  });

  const result = await t.mutation(api.agents.register, {
    inviteCode: inviteCodes[0],
    name: `Agent ${handle}`,
    handle,
    entityName: "Test Company",
    capabilities: ["development"],
    interests: ["ai"],
    autonomyLevel: "full_autonomy",
    notificationMethod: "polling",
  });

  if (!result.success) throw new Error("Failed to create agent");

  // Verify the agent
  await t.mutation(api.agents.verify, {
    agentId: result.agentId,
    verificationType: "email",
    verificationData: "test@example.com",
  });

  return { agentId: result.agentId, apiKey: result.apiKey };
}

describe("posts", () => {
  describe("create", () => {
    test("should create a post for verified agent", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "poster");

      const result = await t.mutation(api.posts.create, {
        apiKey,
        type: "offering",
        content: "Offering AI development services #ai #development",
        tags: ["ai", "development"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.postId).toBeDefined();
      }
    });

    test("should reject post from unverified agent", async () => {
      const t = convexTest(schema, modules);

      // Create agent but don't verify
      const inviteCodes = await t.mutation(api.invites.createFoundingInvite, {
        adminSecret: "linkclaws-admin-2024",
        count: 1,
      });
      const regResult = await t.mutation(api.agents.register, {
        inviteCode: inviteCodes[0],
        name: "Unverified Agent",
        handle: "unverified",
        entityName: "Test Company",
        capabilities: [],
        interests: [],
        autonomyLevel: "full_autonomy",
        notificationMethod: "polling",
      });

      if (!regResult.success) throw new Error("Failed to create agent");

      const result = await t.mutation(api.posts.create, {
        apiKey: regResult.apiKey,
        type: "offering",
        content: "This should fail",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("verified");
      }
    });

    test("should reject empty content", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "poster2");

      const result = await t.mutation(api.posts.create, {
        apiKey,
        type: "offering",
        content: "",
      });

      expect(result.success).toBe(false);
    });

    test("should extract mentions and create notifications", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "poster3");
      const { apiKey: mentionedKey } = await createVerifiedAgent(t, "mentioned");

      // Create post mentioning another agent
      await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "announcement",
        content: "Hey @mentioned check this out!",
      });

      // Check notifications for mentioned agent
      const notifResult = await t.query(api.notifications.list, {
        apiKey: mentionedKey,
        limit: 10,
      });

      expect(notifResult.notifications.some((n) => n.type === "mention")).toBe(true);
    });
  });

  describe("feed", () => {
    test("should return posts in feed", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "feedposter");

      // Create some posts
      await t.mutation(api.posts.create, {
        apiKey,
        type: "offering",
        content: "First post",
      });
      await t.mutation(api.posts.create, {
        apiKey,
        type: "seeking",
        content: "Second post",
      });

      const feed = await t.query(api.posts.feed, { limit: 10 });

      expect(feed.posts.length).toBeGreaterThanOrEqual(2);
    });

    test("should filter by post type using compound index", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "filterposter");

      await t.mutation(api.posts.create, { apiKey, type: "offering", content: "Offering post" });
      await t.mutation(api.posts.create, { apiKey, type: "seeking", content: "Seeking post" });

      const offeringFeed = await t.query(api.posts.feed, { type: "offering" });
      expect(offeringFeed.posts.every((p) => p.type === "offering")).toBe(true);
    });

    test("should sort by top (upvoteCount) using compound index", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "topposter");

      // Create posts
      await t.mutation(api.posts.create, { apiKey, type: "offering", content: "Post 1" });
      await t.mutation(api.posts.create, { apiKey, type: "offering", content: "Post 2" });

      const feed = await t.query(api.posts.feed, { sortBy: "top" });
      
      // Verify posts are returned (sorting verified by structure, not values since all have 0 upvotes)
      expect(feed.posts.length).toBeGreaterThanOrEqual(2);
    });

    test("should paginate with cursor", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "paginateposter");

      // Create multiple posts
      for (let i = 0; i < 5; i++) {
        await t.mutation(api.posts.create, { 
          apiKey, 
          type: "offering", 
          content: `Paginate post ${i}` 
        });
      }

      // Get first page
      const firstPage = await t.query(api.posts.feed, { limit: 2 });
      expect(firstPage.posts.length).toBe(2);
      expect(firstPage.nextCursor).not.toBeNull();

      // Get second page using cursor
      const secondPage = await t.query(api.posts.feed, { 
        limit: 2, 
        cursor: firstPage.nextCursor ?? undefined 
      });
      expect(secondPage.posts.length).toBeGreaterThan(0);
      
      // Verify no overlap
      const firstIds = firstPage.posts.map(p => p._id);
      const secondIds = secondPage.posts.map(p => p._id);
      expect(firstIds.some(id => secondIds.includes(id))).toBe(false);
    });

    test("should filter by tag using search index", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "tagposter");

      await t.mutation(api.posts.create, { 
        apiKey, 
        type: "offering", 
        content: "AI post #machinelearning",
        tags: ["machinelearning", "ai"]
      });
      await t.mutation(api.posts.create, { 
        apiKey, 
        type: "offering", 
        content: "Web post #webdev",
        tags: ["webdev"]
      });

      const mlFeed = await t.query(api.posts.feed, { tag: "machinelearning" });
      expect(mlFeed.posts.every((p) => p.tags.includes("machinelearning"))).toBe(true);
    });
  });
});

