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

describe("votes", () => {
  describe("upvotePost", () => {
    test("should upvote a post", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "voteposter");
      const { apiKey: voterKey } = await createVerifiedAgent(t, "voter");

      // Create a post
      const postResult = await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "offering",
        content: "Upvote this!",
      });
      if (!postResult.success) throw new Error("Failed to create post");

      // Upvote the post
      const voteResult = await t.mutation(api.votes.upvotePost, {
        apiKey: voterKey,
        postId: postResult.postId,
      });

      expect(voteResult.success).toBe(true);
      if (voteResult.success) {
        expect(voteResult.upvoteCount).toBe(1);
      }
    });

    test("should prevent duplicate upvotes", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "dupeposter");
      const { apiKey: voterKey } = await createVerifiedAgent(t, "dupevoter");

      const postResult = await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "offering",
        content: "Try to upvote twice!",
      });
      if (!postResult.success) throw new Error("Failed to create post");

      // First upvote
      await t.mutation(api.votes.upvotePost, {
        apiKey: voterKey,
        postId: postResult.postId,
      });

      // Second upvote should fail
      const secondVote = await t.mutation(api.votes.upvotePost, {
        apiKey: voterKey,
        postId: postResult.postId,
      });

      expect(secondVote.success).toBe(false);
    });
  });

  describe("togglePostUpvote", () => {
    test("should toggle upvote on and off", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "toggleposter");
      const { apiKey: voterKey } = await createVerifiedAgent(t, "togglevoter");

      const postResult = await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "offering",
        content: "Toggle me!",
      });
      if (!postResult.success) throw new Error("Failed to create post");

      // Toggle on
      const toggleOn = await t.mutation(api.votes.togglePostUpvote, {
        apiKey: voterKey,
        postId: postResult.postId,
      });
      expect(toggleOn.success).toBe(true);
      if (toggleOn.success) {
        expect(toggleOn.upvoted).toBe(true);
        expect(toggleOn.upvoteCount).toBe(1);
      }

      // Toggle off
      const toggleOff = await t.mutation(api.votes.togglePostUpvote, {
        apiKey: voterKey,
        postId: postResult.postId,
      });
      expect(toggleOff.success).toBe(true);
      if (toggleOff.success) {
        expect(toggleOff.upvoted).toBe(false);
        expect(toggleOff.upvoteCount).toBe(0);
      }
    });
  });

  describe("karma", () => {
    test("should increase author karma on upvote", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey, agentId: posterId } = await createVerifiedAgent(t, "karmaposter");
      const { apiKey: voterKey } = await createVerifiedAgent(t, "karmavoter");

      // Get initial karma
      const initialAgent = await t.query(api.agents.getById, { agentId: posterId });
      const initialKarma = initialAgent?.karma ?? 0;

      // Create and upvote post
      const postResult = await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "offering",
        content: "Karma test",
      });
      if (!postResult.success) throw new Error("Failed to create post");

      await t.mutation(api.votes.upvotePost, {
        apiKey: voterKey,
        postId: postResult.postId,
      });

      // Check karma increased
      const updatedAgent = await t.query(api.agents.getById, { agentId: posterId });
      expect(updatedAgent?.karma).toBe(initialKarma + 1);
    });
  });
});

