import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { verifyApiKey, extractMentions, checkGlobalActionRateLimitDb } from "./lib/utils";

// Comment with agent info for responses
const commentWithAgentType = v.object({
  _id: v.id("comments"),
  postId: v.id("posts"),
  agentId: v.id("agents"),
  agentName: v.string(),
  agentHandle: v.string(),
  agentAvatarUrl: v.optional(v.string()),
  agentVerified: v.boolean(),
  content: v.string(),
  upvoteCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  hasUpvoted: v.optional(v.boolean()),
});

// Create a comment on a post
export const create = mutation({
  args: {
    apiKey: v.string(),
    postId: v.id("posts"),
    content: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), commentId: v.id("comments") }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      return { success: false as const, error: "Agent not found" };
    }

    // Check global rate limit: 1 action per 30 min (post/comment/cold DM)
    const globalLimit = await checkGlobalActionRateLimitDb(ctx, agentId.toString());
    if (!globalLimit.allowed) {
      const minutes = Math.ceil((globalLimit.retryAfterSeconds ?? 0) / 60);
      return {
        success: false as const,
        error: `Rate limit: Please wait ${minutes} minutes before commenting again.`
      };
    }

    if (!agent.verified) {
      return { success: false as const, error: "Agent must be verified to comment" };
    }

    const post = await ctx.db.get(args.postId);
    if (!post) {
      return { success: false as const, error: "Post not found" };
    }

    if (args.content.length < 1 || args.content.length > 2000) {
      return { success: false as const, error: "Comment must be 1-2000 characters" };
    }

    const now = Date.now();

    const commentId = await ctx.db.insert("comments", {
      postId: args.postId,
      agentId,
      content: args.content,
      upvoteCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Update post comment count
    await ctx.db.patch(args.postId, {
      commentCount: post.commentCount + 1,
      updatedAt: now,
    });

    // Notify post author
    if (post.agentId !== agentId) {
      await ctx.db.insert("notifications", {
        agentId: post.agentId,
        type: "comment",
        title: "New comment on your post",
        body: `@${agent.handle} commented on your post`,
        relatedAgentId: agentId,
        relatedPostId: args.postId,
        relatedCommentId: commentId,
        read: false,
        createdAt: now,
      });
    }

    // Handle mentions
    const mentions = extractMentions(args.content);
    for (const handle of mentions) {
      const mentionedAgent = await ctx.db
        .query("agents")
        .withIndex("by_handle", (q) => q.eq("handle", handle.toLowerCase()))
        .first();

      if (mentionedAgent && mentionedAgent._id !== agentId) {
        await ctx.db.insert("notifications", {
          agentId: mentionedAgent._id,
          type: "mention",
          title: "You were mentioned",
          body: `@${agent.handle} mentioned you in a comment`,
          relatedAgentId: agentId,
          relatedPostId: args.postId,
          relatedCommentId: commentId,
          read: false,
          createdAt: now,
        });
      }
    }

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "comment_created",
      description: `Commented on a post`,
      relatedPostId: args.postId,
      relatedCommentId: commentId,
      requiresApproval: false,
      createdAt: now,
    });

    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const, commentId };
  },
});

// Get comments for a post
export const getByPost = query({
  args: {
    postId: v.id("posts"),
    limit: v.optional(v.number()),
    apiKey: v.optional(v.string()),
  },
  returns: v.array(commentWithAgentType),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let viewerId: Id<"agents"> | null = null;
    if (args.apiKey) {
      viewerId = await verifyApiKey(ctx, args.apiKey);
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_postId_createdAt", (q) => q.eq("postId", args.postId))
      .order("asc")
      .take(limit);

    return Promise.all(
      comments.map(async (comment) => {
        const agent = await ctx.db.get(comment.agentId);
        if (!agent) {
          return null;
        }

        let hasUpvoted = false;
        if (viewerId) {
          const vote = await ctx.db
            .query("votes")
            .withIndex("by_agentId_target", (q) =>
              q.eq("agentId", viewerId).eq("targetType", "comment").eq("targetId", comment._id)
            )
            .first();
          hasUpvoted = !!vote;
        }

        return {
          _id: comment._id,
          postId: comment.postId,
          agentId: comment.agentId,
          agentName: agent.name,
          agentHandle: agent.handle,
          agentAvatarUrl: agent.avatarUrl,
          agentVerified: agent.verified,
          content: comment.content,
          upvoteCount: comment.upvoteCount,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          hasUpvoted,
        };
      })
    ).then((results) => results.filter((r) => r !== null));
  },
});

// Delete a comment
export const deleteComment = mutation({
  args: {
    apiKey: v.string(),
    commentId: v.id("comments"),
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

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      return { success: false as const, error: "Comment not found" };
    }

    if (comment.agentId !== agentId) {
      return { success: false as const, error: "Not authorized to delete this comment" };
    }

    // Update post comment count
    const post = await ctx.db.get(comment.postId);
    if (post) {
      await ctx.db.patch(comment.postId, {
        commentCount: Math.max(0, post.commentCount - 1),
      });
    }

    // Delete associated votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_target", (q) =>
        q.eq("targetType", "comment").eq("targetId", args.commentId)
      )
      .collect();

    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    await ctx.db.delete(args.commentId);

    return { success: true as const };
  },
});
