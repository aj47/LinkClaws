import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { verifyApiKey } from "./lib/utils";
import { connectionStatus } from "./schema";

// Connection with agent info
const connectionWithAgentType = v.object({
  _id: v.id("connections"),
  agentId: v.id("agents"),
  agentName: v.string(),
  agentHandle: v.string(),
  agentAvatarUrl: v.optional(v.string()),
  agentVerified: v.boolean(),
  status: connectionStatus,
  createdAt: v.number(),
});

// Send a connection request (or follow)
export const connect = mutation({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
    message: v.optional(v.string()), // Optional message for connection request
  },
  returns: v.union(
    v.object({ success: v.literal(true), connectionId: v.id("connections") }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    if (agentId === args.targetAgentId) {
      return { success: false as const, error: "Cannot connect with yourself" };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent?.verified) {
      return { success: false as const, error: "Agent must be verified to connect" };
    }

    const targetAgent = await ctx.db.get(args.targetAgentId);
    if (!targetAgent) {
      return { success: false as const, error: "Target agent not found" };
    }

    // Check if connection already exists
    const existingConnection = await ctx.db
      .query("connections")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", agentId).eq("toAgentId", args.targetAgentId)
      )
      .first();

    if (existingConnection) {
      return { success: false as const, error: "Connection already exists" };
    }

    const now = Date.now();

    const connectionId = await ctx.db.insert("connections", {
      fromAgentId: agentId,
      toAgentId: args.targetAgentId,
      status: "accepted", // Auto-accept for now (like Twitter follow)
      message: args.message,
      createdAt: now,
      updatedAt: now,
    });

    // Notify target agent with optional message
    const notificationBody = args.message
      ? `@${agent.handle} is now following you: "${args.message}"`
      : `@${agent.handle} is now following you`;

    await ctx.db.insert("notifications", {
      agentId: args.targetAgentId,
      type: "connection_accepted",
      title: "New follower",
      body: notificationBody,
      relatedAgentId: agentId,
      read: false,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "connection_created",
      description: `Started following @${targetAgent.handle}`,
      relatedAgentId: args.targetAgentId,
      requiresApproval: false,
      createdAt: now,
    });

    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const, connectionId };
  },
});

// Unfollow/disconnect
export const disconnect = mutation({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    const connection = await ctx.db
      .query("connections")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", agentId).eq("toAgentId", args.targetAgentId)
      )
      .first();

    if (!connection) {
      return { success: false as const, error: "Connection not found" };
    }

    await ctx.db.delete(connection._id);

    return { success: true as const };
  },
});

// Get agents I'm following
export const getFollowing = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  returns: v.array(connectionWithAgentType),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const connections = await ctx.db
      .query("connections")
      .withIndex("by_fromAgentId_status", (q) =>
        q.eq("fromAgentId", args.agentId).eq("status", "accepted")
      )
      .take(limit);

    return Promise.all(
      connections.map(async (conn) => {
        const agent = await ctx.db.get(conn.toAgentId);
        if (!agent) return null;

        return {
          _id: conn._id,
          agentId: agent._id,
          agentName: agent.name,
          agentHandle: agent.handle,
          agentAvatarUrl: agent.avatarUrl,
          agentVerified: agent.verified,
          status: conn.status,
          createdAt: conn.createdAt,
        };
      })
    ).then((results) => results.filter((r) => r !== null));
  },
});

// Get agents following me
export const getFollowers = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  returns: v.array(connectionWithAgentType),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const connections = await ctx.db
      .query("connections")
      .withIndex("by_toAgentId_status", (q) =>
        q.eq("toAgentId", args.agentId).eq("status", "accepted")
      )
      .take(limit);

    return Promise.all(
      connections.map(async (conn) => {
        const agent = await ctx.db.get(conn.fromAgentId);
        if (!agent) return null;

        return {
          _id: conn._id,
          agentId: agent._id,
          agentName: agent.name,
          agentHandle: agent.handle,
          agentAvatarUrl: agent.avatarUrl,
          agentVerified: agent.verified,
          status: conn.status,
          createdAt: conn.createdAt,
        };
      })
    ).then((results) => results.filter((r) => r !== null));
  },
});

// Check if following
export const isFollowing = query({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return false;

    const connection = await ctx.db
      .query("connections")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", agentId).eq("toAgentId", args.targetAgentId)
      )
      .first();

    return !!connection && connection.status === "accepted";
  },
});

// Get connection counts
export const getCounts = query({
  args: { agentId: v.id("agents") },
  returns: v.object({
    following: v.number(),
    followers: v.number(),
  }),
  handler: async (ctx, args) => {
    const following = await ctx.db
      .query("connections")
      .withIndex("by_fromAgentId_status", (q) =>
        q.eq("fromAgentId", args.agentId).eq("status", "accepted")
      )
      .collect();

    const followers = await ctx.db
      .query("connections")
      .withIndex("by_toAgentId_status", (q) =>
        q.eq("toAgentId", args.agentId).eq("status", "accepted")
      )
      .collect();

    return {
      following: following.length,
      followers: followers.length,
    };
  },
});

// Get pending connection requests for current agent
export const getPendingRequests = query({
  args: {
    apiKey: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("connections"),
      fromAgentId: v.id("agents"),
      fromAgentName: v.string(),
      fromAgentHandle: v.string(),
      fromAgentAvatarUrl: v.optional(v.string()),
      fromAgentVerified: v.boolean(),
      message: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return [];

    const limit = args.limit ?? 50;
    const requests = await ctx.db
      .query("connections")
      .withIndex("by_toAgentId_status", (q) =>
        q.eq("toAgentId", agentId).eq("status", "pending")
      )
      .take(limit);

    return Promise.all(
      requests.map(async (conn) => {
        const agent = await ctx.db.get(conn.fromAgentId);
        if (!agent) return null;

        return {
          _id: conn._id,
          fromAgentId: agent._id,
          fromAgentName: agent.name,
          fromAgentHandle: agent.handle,
          fromAgentAvatarUrl: agent.avatarUrl,
          fromAgentVerified: agent.verified,
          message: conn.message,
          createdAt: conn.createdAt,
        };
      })
    ).then((results) => results.filter((r) => r !== null));
  },
});

// Toggle follow (convenience function)
export const toggleFollow = mutation({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
    message: v.optional(v.string()), // Optional message for connection request
  },
  returns: v.union(
    v.object({ success: v.literal(true), isFollowing: v.boolean() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    if (agentId === args.targetAgentId) {
      return { success: false as const, error: "Cannot follow yourself" };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent?.verified) {
      return { success: false as const, error: "Agent must be verified to follow" };
    }

    const targetAgent = await ctx.db.get(args.targetAgentId);
    if (!targetAgent) {
      return { success: false as const, error: "Target agent not found" };
    }

    const existingConnection = await ctx.db
      .query("connections")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", agentId).eq("toAgentId", args.targetAgentId)
      )
      .first();

    const now = Date.now();

    if (existingConnection) {
      await ctx.db.delete(existingConnection._id);
      return { success: true as const, isFollowing: false };
    } else {
      await ctx.db.insert("connections", {
        fromAgentId: agentId,
        toAgentId: args.targetAgentId,
        status: "accepted",
        message: args.message,
        createdAt: now,
        updatedAt: now,
      });

      // Notify target agent with optional message
      const notificationBody = args.message
        ? `@${agent.handle} is now following you: "${args.message}"`
        : `@${agent.handle} is now following you`;

      await ctx.db.insert("notifications", {
        agentId: args.targetAgentId,
        type: "connection_accepted",
        title: "New follower",
        body: notificationBody,
        relatedAgentId: agentId,
        read: false,
        createdAt: now,
      });

      return { success: true as const, isFollowing: true };
    }
  },
});
