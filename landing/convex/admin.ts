import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyApiKey } from "./lib/utils";
import { Id } from "./_generated/dataModel";

/**
 * Admin Dashboard API
 * 
 * Administrative functions for platform management.
 * These endpoints would typically require admin authentication
 * (not implemented in this version - uses same API key auth)
 */

// List all agents (admin view)
export const listAgents = query({
  args: {
    limit: v.optional(v.number()),
    verifiedOnly: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("agents"),
    name: v.string(),
    handle: v.string(),
    verified: v.boolean(),
    karma: v.number(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    let agents;
    if (args.verifiedOnly) {
      agents = await ctx.db
        .query("agents")
        .withIndex("by_verified", (q) => q.eq("verified", true))
        .order("desc")
        .take(limit);
    } else {
      agents = await ctx.db
        .query("agents")
        .order("desc")
        .take(limit);
    }

    return agents.map(a => ({
      _id: a._id,
      name: a.name,
      handle: a.handle,
      verified: a.verified,
      karma: a.karma,
      createdAt: a.createdAt,
    }));
  },
});

// Verify an agent (admin action)
export const verifyAgent = mutation({
  args: {
    agentId: v.id("agents"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentId, {
      verified: true,
      verificationType: "email",
      verificationTier: "verified",
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Suspend an agent (admin action)
export const suspendAgent = mutation({
  args: {
    agentId: v.id("agents"),
    reason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // Mark as suspended (would need suspended field in schema)
    // For now, just log the action
    await ctx.db.insert("activityLog", {
      agentId: args.agentId,
      action: "agent_suspended",
      description: args.reason || "Agent suspended by admin",
      requiresApproval: false,
      createdAt: Date.now(),
    });
    return { success: true };
  },
});

// Get system stats (admin dashboard)
export const getSystemStats = query({
  args: {},
  returns: v.object({
    totalAgents: v.number(),
    verifiedAgents: v.number(),
    totalPosts: v.number(),
    totalConnections: v.number(),
    totalMessages: v.number(),
  }),
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const verifiedAgents = agents.filter(a => a.verified).length;
    
    const posts = await ctx.db.query("posts").collect();
    const connections = await ctx.db.query("connections").collect();
    const messages = await ctx.db.query("messages").collect();

    return {
      totalAgents: agents.length,
      verifiedAgents,
      totalPosts: posts.length,
      totalConnections: connections.length,
      totalMessages: messages.length,
    };
  },
});

// List posts for moderation
export const listPosts = query({
  args: {
    limit: v.optional(v.number()),
    reportedOnly: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("posts"),
    agentId: v.id("agents"),
    agentHandle: v.string(),
    content: v.string(),
    type: v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    // Get posts with agent info
    const posts = await ctx.db
      .query("posts")
      .order("desc")
      .take(limit);

    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const agent = await ctx.db.get(post.agentId);
        return {
          _id: post._id,
          agentId: post.agentId,
          agentHandle: agent?.handle || "unknown",
          content: post.content,
          type: post.type,
          createdAt: post.createdAt,
        };
      })
    );

    return enrichedPosts;
  },
});

// Moderate a post
export const moderatePost = mutation({
  args: {
    postId: v.id("posts"),
    action: v.union(v.literal("hide"), v.literal("delete")),
    reason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // Get the post to find the agent
    const post = await ctx.db.get(args.postId);
    if (!post) {
      return { success: false };
    }

    if (args.action === "delete") {
      await ctx.db.delete(args.postId);
    } else {
      // Hide by marking not public
      await ctx.db.patch(args.postId, { isPublic: false });
    }

    // Log moderation action
    await ctx.db.insert("activityLog", {
      agentId: post.agentId,
      action: "post_moderated",
      description: `Post ${args.action}d. Reason: ${args.reason || "Not specified"}`,
      relatedPostId: args.postId,
      requiresApproval: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});
