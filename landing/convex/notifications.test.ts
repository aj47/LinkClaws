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

describe("notifications", () => {
  describe("list", () => {
    test("should return notifications for agent", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "notifposter");
      const { apiKey: mentionedKey } = await createVerifiedAgent(t, "notifmentioned");

      // Create a post that mentions the other agent
      await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "announcement",
        content: "Hey @notifmentioned check this out!",
      });

      // Get notifications
      const notifications = await t.query(api.notifications.list, {
        apiKey: mentionedKey,
        limit: 10,
      });

      expect(notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifications.some((n) => n.type === "mention")).toBe(true);
    });

    test("should filter unread only", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "unreadposter");
      const { apiKey: mentionedKey } = await createVerifiedAgent(t, "unreadmentioned");

      // Create notification via mention
      await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "announcement",
        content: "Hey @unreadmentioned!",
      });

      // Get unread only
      const unreadNotifications = await t.query(api.notifications.list, {
        apiKey: mentionedKey,
        unreadOnly: true,
      });

      expect(unreadNotifications.every((n) => !n.read)).toBe(true);
    });
  });

  describe("markAsRead", () => {
    test("should mark a notification as read", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "markposter");
      const { apiKey: mentionedKey } = await createVerifiedAgent(t, "markmentioned");

      // Create notification
      await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "announcement",
        content: "Hey @markmentioned!",
      });

      // Get notifications
      const notifications = await t.query(api.notifications.list, {
        apiKey: mentionedKey,
        limit: 10,
      });
      const notifId = notifications[0]._id;

      // Mark as read
      const result = await t.mutation(api.notifications.markAsRead, {
        apiKey: mentionedKey,
        notificationId: notifId,
      });

      expect(result.success).toBe(true);

      // Verify it's marked as read
      const updatedNotifications = await t.query(api.notifications.list, {
        apiKey: mentionedKey,
        limit: 10,
      });
      const updatedNotif = updatedNotifications.find((n) => n._id === notifId);
      expect(updatedNotif?.read).toBe(true);
    });
  });

  describe("markAllAsRead", () => {
    test("should mark all notifications as read", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "markallposter");
      const { apiKey: mentionedKey } = await createVerifiedAgent(t, "markallmentioned");

      // Create multiple notifications
      await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "announcement",
        content: "First @markallmentioned!",
      });
      await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "announcement",
        content: "Second @markallmentioned!",
      });

      // Mark all as read
      const result = await t.mutation(api.notifications.markAllAsRead, {
        apiKey: mentionedKey,
      });

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(2);

      // Verify all are read
      const unreadCount = await t.query(api.notifications.getUnreadCount, {
        apiKey: mentionedKey,
      });
      expect(unreadCount).toBe(0);
    });
  });

  describe("getUnreadCount", () => {
    test("should return correct unread count", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: posterKey } = await createVerifiedAgent(t, "countposter");
      const { apiKey: mentionedKey } = await createVerifiedAgent(t, "countmentioned");

      // Create notifications
      await t.mutation(api.posts.create, {
        apiKey: posterKey,
        type: "announcement",
        content: "Hey @countmentioned!",
      });

      const count = await t.query(api.notifications.getUnreadCount, {
        apiKey: mentionedKey,
      });

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});

