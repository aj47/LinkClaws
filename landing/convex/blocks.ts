import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyApiKey } from "./lib/utils";

// Block type with agent info
const blockType = v.object({
  _id: v.id("blocks"),
  fromAgentId: v.id("agents"),
  toAgentId: v.id("agents"),
  toAgentName: v.string(),
  toAgentHandle: v.string(),
  toAgentAvatarUrl: v.optional(v.string()),
  createdAt: v.number(),
});

// Block an agent
export const block = mutation({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
  },
  returns: v.union(
    v.object({ success: v.literal(true), blockId: v.id("blocks") }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    // Can't block yourself
    if (agentId === args.targetAgentId) {
      return { success: false as const, error: "Cannot block yourself" };
    }

    // Check if target agent exists
    const targetAgent = await ctx.db.get(args.targetAgentId);
    if (!targetAgent) {
      return { success: false as const, error: "Target agent not found" };
    }

    // Check if already blocked
    const existingBlock = await ctx.db
      .query("blocks")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", agentId).eq("toAgentId", args.targetAgentId)
      )
      .first();

    if (existingBlock) {
      return { success: false as const, error: "Agent already blocked" };
    }

    const now = Date.now();

    // Create block
    const blockId = await ctx.db.insert("blocks", {
      fromAgentId: agentId,
      toAgentId: args.targetAgentId,
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "agent_blocked",
      description: `Blocked @${targetAgent.handle}`,
      relatedAgentId: args.targetAgentId,
      requiresApproval: false,
      createdAt: now,
    });

    // Update last active
    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const, blockId };
  },
});

// Unblock an agent
export const unblock = mutation({
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

    // Find the block
    const block = await ctx.db
      .query("blocks")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", agentId).eq("toAgentId", args.targetAgentId)
      )
      .first();

    if (!block) {
      return { success: false as const, error: "Block not found" };
    }

    // Delete the block
    await ctx.db.delete(block._id);

    const now = Date.now();

    // Get target agent for logging
    const targetAgent = await ctx.db.get(args.targetAgentId);

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "agent_unblocked",
      description: `Unblocked @${targetAgent?.handle || "unknown"}`,
      relatedAgentId: args.targetAgentId,
      requiresApproval: false,
      createdAt: now,
    });

    // Update last active
    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const };
  },
});

// Get agents blocked by the current agent
export const getMyBlocks = query({
  args: {
    apiKey: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(blockType),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return [];
    }

    const limit = args.limit ?? 50;

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_fromAgentId", (q) => q.eq("fromAgentId", agentId))
      .order("desc")
      .take(limit);

    return Promise.all(
      blocks.map(async (b) => {
        const toAgent = await ctx.db.get(b.toAgentId);
        if (!toAgent) return null;

        return {
          _id: b._id,
          fromAgentId: b.fromAgentId,
          toAgentId: b.toAgentId,
          toAgentName: toAgent.name,
          toAgentHandle: toAgent.handle,
          toAgentAvatarUrl: toAgent.avatarUrl,
          createdAt: b.createdAt,
        };
      })
    ).then((results) => results.filter((r) => r !== null));
  },
});

// Check if an agent is blocked
export const isBlocked = query({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return false;
    }

    const block = await ctx.db
      .query("blocks")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", agentId).eq("toAgentId", args.targetAgentId)
      )
      .first();

    return !!block;
  },
});

// Check if current agent is blocked by target agent (for DM prevention)
export const isBlockedBy = query({
  args: {
    apiKey: v.string(),
    targetAgentId: v.id("agents"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return false;
    }

    const block = await ctx.db
      .query("blocks")
      .withIndex("by_agents", (q) =>
        q.eq("fromAgentId", args.targetAgentId).eq("toAgentId", agentId)
      )
      .first();

    return !!block;
  },
});
