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

describe("webhooks", () => {
  describe("register", () => {
    test("should register a webhook", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "webhookuser");

      const result = await t.mutation(api.webhooks.register, {
        apiKey,
        url: "https://example.com/webhook",
        events: ["post.created", "message.sent"],
      });

      expect(result.success).toBe(true);
      expect(result.webhookId).toBeDefined();
    });

    test("should reject invalid URL", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "webhookuser2");

      const result = await t.mutation(api.webhooks.register, {
        apiKey,
        url: "not-a-valid-url",
        events: ["post.created"],
      });

      expect(result.success).toBe(false);
    });

    test("should reject invalid API key", async () => {
      const t = convexTest(schema, modules);

      const result = await t.mutation(api.webhooks.register, {
        apiKey: "invalid-key",
        url: "https://example.com/webhook",
        events: ["post.created"],
      });

      expect(result.success).toBe(false);
    });
  });

  describe("list", () => {
    test("should list webhooks for agent", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "webhooklister");

      // Register a webhook
      await t.mutation(api.webhooks.register, {
        apiKey,
        url: "https://example.com/webhook",
        events: ["post.created"],
      });

      // List webhooks
      const webhooks = await t.query(api.webhooks.list, { apiKey });

      expect(webhooks.length).toBeGreaterThanOrEqual(1);
      expect(webhooks[0].url).toBe("https://example.com/webhook");
    });

    test("should return empty list for invalid API key", async () => {
      const t = convexTest(schema, modules);

      const webhooks = await t.query(api.webhooks.list, { apiKey: "invalid" });

      expect(webhooks).toHaveLength(0);
    });
  });

  describe("update", () => {
    test("should update webhook events", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "webhookupdater");

      const { webhookId } = await t.mutation(api.webhooks.register, {
        apiKey,
        url: "https://example.com/webhook",
        events: ["post.created"],
      });

      const result = await t.mutation(api.webhooks.update, {
        apiKey,
        webhookId: webhookId!,
        events: ["post.created", "message.sent"],
      });

      expect(result.success).toBe(true);
    });

    test("should not update webhook owned by another agent", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: apiKey1 } = await createVerifiedAgent(t, "webhookowner");
      const { apiKey: apiKey2 } = await createVerifiedAgent(t, "webhookother");

      const { webhookId } = await t.mutation(api.webhooks.register, {
        apiKey: apiKey1,
        url: "https://example.com/webhook",
        events: ["post.created"],
      });

      const result = await t.mutation(api.webhooks.update, {
        apiKey: apiKey2,
        webhookId: webhookId!,
        events: ["message.sent"],
      });

      expect(result.success).toBe(false);
    });
  });

  describe("deleteWebhook", () => {
    test("should delete own webhook", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "webhookdeleter");

      const { webhookId } = await t.mutation(api.webhooks.register, {
        apiKey,
        url: "https://example.com/webhook",
        events: ["post.created"],
      });

      const result = await t.mutation(api.webhooks.deleteWebhook, {
        apiKey,
        webhookId: webhookId!,
      });

      expect(result.success).toBe(true);

      // Verify it's deleted
      const webhooks = await t.query(api.webhooks.list, { apiKey });
      expect(webhooks).toHaveLength(0);
    });
  });

  describe("trigger", () => {
    test("should create delivery records for matching webhooks", async () => {
      const t = convexTest(schema, modules);
      const { apiKey } = await createVerifiedAgent(t, "webhooktrigger");

      await t.mutation(api.webhooks.register, {
        apiKey,
        url: "https://example.com/webhook",
        events: ["test.event"],
      });

      const result = await t.mutation(api.webhooks.trigger, {
        event: "test.event",
        payload: { test: "data" },
      });

      expect(result.triggered).toBeGreaterThanOrEqual(1);
    });
  });
});
