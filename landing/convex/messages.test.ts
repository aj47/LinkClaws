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

describe("messages", () => {
  describe("sendDirect", () => {
    test("should send a direct message", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: senderKey } = await createVerifiedAgent(t, "sender");
      const { agentId: receiverId } = await createVerifiedAgent(t, "receiver");

      const result = await t.mutation(api.messages.sendDirect, {
        apiKey: senderKey,
        targetAgentId: receiverId,
        content: "Hello, this is a test message!",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.threadId).toBeDefined();
        expect(result.messageId).toBeDefined();
      }
    });

    test("should prevent self-messaging", async () => {
      const t = convexTest(schema, modules);
      const { apiKey, agentId } = await createVerifiedAgent(t, "selfmessager");

      const result = await t.mutation(api.messages.sendDirect, {
        apiKey,
        targetAgentId: agentId,
        content: "Talking to myself",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("getThreads", () => {
    test("should return message threads", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: senderKey } = await createVerifiedAgent(t, "threadsender");
      const { agentId: receiverId, apiKey: receiverKey } = await createVerifiedAgent(t, "threadreceiver");

      // Send a message
      await t.mutation(api.messages.sendDirect, {
        apiKey: senderKey,
        targetAgentId: receiverId,
        content: "Thread test message",
      });

      // Check sender's threads
      const senderThreads = await t.query(api.messages.getThreads, {
        apiKey: senderKey,
        limit: 10,
      });
      expect(senderThreads.length).toBe(1);

      // Check receiver's threads
      const receiverThreads = await t.query(api.messages.getThreads, {
        apiKey: receiverKey,
        limit: 10,
      });
      expect(receiverThreads.length).toBe(1);
    });
  });

  describe("getMessages", () => {
    test("should return messages in a thread", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: senderKey } = await createVerifiedAgent(t, "msgsender");
      const { agentId: receiverId, apiKey: receiverKey } = await createVerifiedAgent(t, "msgreceiver");

      // Send messages
      const sendResult = await t.mutation(api.messages.sendDirect, {
        apiKey: senderKey,
        targetAgentId: receiverId,
        content: "First message",
      });
      if (!sendResult.success) throw new Error("Failed to send message");

      await t.mutation(api.messages.send, {
        apiKey: senderKey,
        threadId: sendResult.threadId,
        content: "Second message",
      });

      // Get messages
      const messages = await t.query(api.messages.getMessages, {
        apiKey: senderKey,
        threadId: sendResult.threadId,
        limit: 10,
      });

      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe("First message");
      expect(messages[1].content).toBe("Second message");
    });
  });

  describe("markAsRead", () => {
    test("should mark messages as read", async () => {
      const t = convexTest(schema, modules);
      const { apiKey: senderKey } = await createVerifiedAgent(t, "readsender");
      const { agentId: receiverId, apiKey: receiverKey } = await createVerifiedAgent(t, "readreceiver");

      // Send a message
      const sendResult = await t.mutation(api.messages.sendDirect, {
        apiKey: senderKey,
        targetAgentId: receiverId,
        content: "Read me!",
      });
      if (!sendResult.success) throw new Error("Failed to send message");

      // Mark as read by receiver
      const markResult = await t.mutation(api.messages.markAsRead, {
        apiKey: receiverKey,
        threadId: sendResult.threadId,
      });

      expect(markResult.success).toBe(true);
    });
  });
});

