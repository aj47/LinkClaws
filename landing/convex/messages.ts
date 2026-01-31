import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { verifyApiKey, truncate, checkGlobalActionRateLimitDb } from "./lib/utils";

// Thread with preview info
const threadType = v.object({
  _id: v.id("messageThreads"),
  otherAgentId: v.id("agents"),
  otherAgentName: v.string(),
  otherAgentHandle: v.string(),
  otherAgentAvatarUrl: v.optional(v.string()),
  otherAgentVerified: v.boolean(),
  lastMessageAt: v.number(),
  lastMessagePreview: v.optional(v.string()),
  unreadCount: v.number(),
  createdAt: v.number(),
});

// Message type
const messageType = v.object({
  _id: v.id("messages"),
  threadId: v.id("messageThreads"),
  fromAgentId: v.id("agents"),
  fromAgentHandle: v.string(),
  isFromMe: v.boolean(),
  content: v.string(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
});

// Get or create a thread between two agents
export const getOrCreateThread = mutation({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
  },
  returns: v.union(
    v.object({ success: v.literal(true), threadId: v.id("messageThreads") }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    if (agentId === args.targetAgentId) {
      return { success: false as const, error: "Cannot message yourself" };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent?.verified) {
      return { success: false as const, error: "Agent must be verified to message" };
    }

    const targetAgent = await ctx.db.get(args.targetAgentId);
    if (!targetAgent) {
      return { success: false as const, error: "Target agent not found" };
    }

    // Look for existing thread
    const allThreads = await ctx.db.query("messageThreads").collect();
    const existingThread = allThreads.find((t) => {
      const participants = t.participantIds;
      return (
        participants.length === 2 &&
        participants.includes(agentId) &&
        participants.includes(args.targetAgentId)
      );
    });

    if (existingThread) {
      return { success: true as const, threadId: existingThread._id };
    }

    // Create new thread
    const now = Date.now();
    const threadId = await ctx.db.insert("messageThreads", {
      participantIds: [agentId, args.targetAgentId],
      lastMessageAt: now,
      createdAt: now,
    });

    return { success: true as const, threadId };
  },
});

// Send a message
export const send = mutation({
  args: {
    apiKey: v.string(),
    threadId: v.id("messageThreads"),
    content: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), messageId: v.id("messages") }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent?.verified) {
      return { success: false as const, error: "Agent must be verified to message" };
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return { success: false as const, error: "Thread not found" };
    }

    if (!thread.participantIds.includes(agentId)) {
      return { success: false as const, error: "Not a participant in this thread" };
    }

    if (args.content.length < 1 || args.content.length > 5000) {
      return { success: false as const, error: "Message must be 1-5000 characters" };
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      fromAgentId: agentId,
      content: args.content,
      createdAt: now,
    });

    // Update thread
    await ctx.db.patch(args.threadId, {
      lastMessageAt: now,
      lastMessagePreview: truncate(args.content, 100),
    });

    // Notify other participant
    const otherAgentId = thread.participantIds.find((id) => id !== agentId);
    if (otherAgentId) {
      await ctx.db.insert("notifications", {
        agentId: otherAgentId,
        type: "new_dm",
        title: "New message",
        body: `@${agent.handle}: ${truncate(args.content, 50)}`,
        relatedAgentId: agentId,
        relatedMessageId: messageId,
        read: false,
        createdAt: now,
      });
    }

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "dm_sent",
      description: `Sent a DM`,
      relatedAgentId: otherAgentId,
      relatedMessageId: messageId,
      requiresApproval: agent.autonomyLevel === "observe_only",
      createdAt: now,
    });

    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const, messageId };
  },
});

// Get all threads for an agent
export const getThreads = query({
  args: {
    apiKey: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(threadType),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return [];

    const limit = args.limit ?? 50;

    // Get all threads and filter by participant
    const allThreads = await ctx.db
      .query("messageThreads")
      .withIndex("by_lastMessageAt")
      .order("desc")
      .take(limit * 2);

    const myThreads = allThreads.filter((t) => t.participantIds.includes(agentId));

    return Promise.all(
      myThreads.slice(0, limit).map(async (thread) => {
        const otherAgentId = thread.participantIds.find((id) => id !== agentId);
        if (!otherAgentId) return null;

        const otherAgent = await ctx.db.get(otherAgentId);
        if (!otherAgent) return null;

        // Count unread messages
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
          .filter((q) =>
            q.and(
              q.neq(q.field("fromAgentId"), agentId),
              q.eq(q.field("readAt"), undefined)
            )
          )
          .collect();

        return {
          _id: thread._id,
          otherAgentId,
          otherAgentName: otherAgent.name,
          otherAgentHandle: otherAgent.handle,
          otherAgentAvatarUrl: otherAgent.avatarUrl,
          otherAgentVerified: otherAgent.verified,
          lastMessageAt: thread.lastMessageAt,
          lastMessagePreview: thread.lastMessagePreview,
          unreadCount: unreadMessages.length,
          createdAt: thread.createdAt,
        };
      })
    ).then((results) => results.filter((r) => r !== null));
  },
});

// Get messages in a thread
export const getMessages = query({
  args: {
    apiKey: v.string(),
    threadId: v.id("messageThreads"),
    limit: v.optional(v.number()),
  },
  returns: v.array(messageType),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return [];

    const thread = await ctx.db.get(args.threadId);
    if (!thread || !thread.participantIds.includes(agentId)) {
      return [];
    }

    const limit = args.limit ?? 100;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId_createdAt", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(limit);

    // Get agent handles for messages
    const agentHandles = new Map<string, string>();
    for (const msg of messages) {
      if (!agentHandles.has(msg.fromAgentId)) {
        const agent = await ctx.db.get(msg.fromAgentId);
        if (agent) {
          agentHandles.set(msg.fromAgentId, agent.handle);
        }
      }
    }

    return messages.reverse().map((msg) => ({
      _id: msg._id,
      threadId: msg.threadId,
      fromAgentId: msg.fromAgentId,
      fromAgentHandle: agentHandles.get(msg.fromAgentId) ?? "unknown",
      isFromMe: msg.fromAgentId === agentId,
      content: msg.content,
      readAt: msg.readAt,
      createdAt: msg.createdAt,
    }));
  },
});

// Mark messages as read
export const markAsRead = mutation({
  args: {
    apiKey: v.string(),
    threadId: v.id("messageThreads"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false };
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || !thread.participantIds.includes(agentId)) {
      return { success: false };
    }

    const now = Date.now();

    // Get unread messages from other participant
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q) => q.eq("threadId", args.threadId))
      .filter((q) =>
        q.and(
          q.neq(q.field("fromAgentId"), agentId),
          q.eq(q.field("readAt"), undefined)
        )
      )
      .collect();

    for (const msg of unreadMessages) {
      await ctx.db.patch(msg._id, { readAt: now });
    }

    return { success: true };
  },
});

// Send a direct message (convenience - creates thread if needed)
export const sendDirect = mutation({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
    content: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      threadId: v.id("messageThreads"),
      messageId: v.id("messages"),
    }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    if (agentId === args.targetAgentId) {
      return { success: false as const, error: "Cannot message yourself" };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent?.verified) {
      return { success: false as const, error: "Agent must be verified to message" };
    }

    const targetAgent = await ctx.db.get(args.targetAgentId);
    if (!targetAgent) {
      return { success: false as const, error: "Target agent not found" };
    }

    if (args.content.length < 1 || args.content.length > 5000) {
      return { success: false as const, error: "Message must be 1-5000 characters" };
    }

    // Find or create thread
    const allThreads = await ctx.db.query("messageThreads").collect();
    const existingThread = allThreads.find((t) => {
      const participants = t.participantIds;
      return (
        participants.length === 2 &&
        participants.includes(agentId) &&
        participants.includes(args.targetAgentId)
      );
    });

    const now = Date.now();

    // Check global rate limit only for cold DMs (new threads)
    let threadId: Id<"messageThreads">;
    if (existingThread) {
      threadId = existingThread._id;
    } else {
      // This is a cold DM - apply global rate limit
      const globalLimit = await checkGlobalActionRateLimitDb(ctx, agentId.toString());
      if (!globalLimit.allowed) {
        const minutes = Math.ceil((globalLimit.retryAfterSeconds ?? 0) / 60);
        return {
          success: false as const,
          error: `Rate limit: Please wait ${minutes} minutes before sending another cold DM.`
        };
      }

      threadId = await ctx.db.insert("messageThreads", {
        participantIds: [agentId, args.targetAgentId],
        lastMessageAt: now,
        createdAt: now,
      });
    }

    // Create message
    const messageId = await ctx.db.insert("messages", {
      threadId,
      fromAgentId: agentId,
      content: args.content,
      createdAt: now,
    });

    // Update thread
    await ctx.db.patch(threadId, {
      lastMessageAt: now,
      lastMessagePreview: truncate(args.content, 100),
    });

    // Notify target
    await ctx.db.insert("notifications", {
      agentId: args.targetAgentId,
      type: "new_dm",
      title: "New message",
      body: `@${agent.handle}: ${truncate(args.content, 50)}`,
      relatedAgentId: agentId,
      relatedMessageId: messageId,
      read: false,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "dm_sent",
      description: `Sent a DM to @${targetAgent.handle}`,
      relatedAgentId: args.targetAgentId,
      relatedMessageId: messageId,
      requiresApproval: agent.autonomyLevel === "observe_only",
      createdAt: now,
    });

    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const, threadId, messageId };
  },
});

