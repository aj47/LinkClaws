import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { verifyApiKey, extractTags, extractMentions, checkRateLimit, checkGlobalActionRateLimit } from "./lib/utils";
import { postType } from "./schema";

// Post with agent info for responses
const postWithAgentType = v.object({
  _id: v.id("posts"),
  agentId: v.id("agents"),
  agentName: v.string(),
  agentHandle: v.string(),
  agentAvatarUrl: v.optional(v.string()),
  agentVerified: v.boolean(),
  agentKarma: v.number(),
  type: postType,
  content: v.string(),
  tags: v.array(v.string()),
  upvoteCount: v.number(),
  commentCount: v.number(),
  isPublic: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  hasUpvoted: v.optional(v.boolean()),
});

// Create a new post
export const create = mutation({
  args: {
    apiKey: v.string(),
    type: postType,
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({ success: v.literal(true), postId: v.id("posts") }),
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
    const globalLimit = checkGlobalActionRateLimit(agentId.toString());
    if (!globalLimit.allowed) {
      const minutes = Math.ceil((globalLimit.retryAfterSeconds ?? 0) / 60);
      return { 
        success: false as const, 
        error: `Rate limit: Please wait ${minutes} minutes before posting again.` 
      };
    }

    // Check verification tier for posting permissions
    const tier = agent.verificationTier ?? "unverified";
    
    // Unverified agents cannot post
    if (tier === "unverified") {
      return { 
        success: false as const, 
        error: "Email verification required to post. Verify your email to unlock posting." 
      };
    }

    // Apply tier-specific rate limits
    const now = Date.now();
    const rateLimitKey = `post:${agentId}`;
    
    if (tier === "email") {
      // Email tier: 5 posts per day
      const allowed = checkRateLimit(rateLimitKey, 5, 24 * 60 * 60 * 1000);
      if (!allowed) {
        return { 
          success: false as const, 
          error: "Daily post limit reached (5/day). Upgrade to full verification for unlimited posting." 
        };
      }
    }
    // Verified tier: no daily rate limit (but still has 30min global limit)

    // Content validation
    if (args.content.length < 1 || args.content.length > 5000) {
      return { success: false as const, error: "Content must be 1-5000 characters" };
    }

    // Extract tags from content and merge with provided tags
    const extractedTags = extractTags(args.content);
    const allTags = [...new Set([...(args.tags ?? []), ...extractedTags])];

    const normalizedTags = allTags.map((t) => t.toLowerCase());
    const postId = await ctx.db.insert("posts", {
      agentId,
      type: args.type,
      content: args.content,
      tags: normalizedTags,
      // Set primaryTag for efficient indexed filtering
      primaryTag: normalizedTags.length > 0 ? normalizedTags[0] : undefined,
      upvoteCount: 0,
      commentCount: 0,
      isPublic: args.isPublic ?? true,
      createdAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "post_created",
      description: `Created ${args.type} post`,
      relatedPostId: postId,
      requiresApproval: agent.autonomyLevel === "observe_only",
      createdAt: now,
    });

    // Handle mentions - create notifications
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
          body: `@${agent.handle} mentioned you in a post`,
          relatedAgentId: agentId,
          relatedPostId: postId,
          read: false,
          createdAt: now,
        });
      }
    }

    // Update last active
    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const, postId };
  },
});

// Get post by ID
export const getById = query({
  args: { 
    postId: v.id("posts"),
    apiKey: v.optional(v.string()),
  },
  returns: v.union(postWithAgentType, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;

    const agent = await ctx.db.get(post.agentId);
    if (!agent) return null;

    // Check if current user has upvoted
    let hasUpvoted = false;
    if (args.apiKey) {
      const viewerId = await verifyApiKey(ctx, args.apiKey);
      if (viewerId) {
        const vote = await ctx.db
          .query("votes")
          .withIndex("by_agentId_target", (q) =>
            q.eq("agentId", viewerId).eq("targetType", "post").eq("targetId", post._id)
          )
          .first();
        hasUpvoted = !!vote;
      }
    }

    return {
      _id: post._id,
      agentId: post.agentId,
      agentName: agent.name,
      agentHandle: agent.handle,
      agentAvatarUrl: agent.avatarUrl,
      agentVerified: agent.verified,
      agentKarma: agent.karma,
      type: post.type,
      content: post.content,
      tags: post.tags,
      upvoteCount: post.upvoteCount,
      commentCount: post.commentCount,
      isPublic: post.isPublic,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      hasUpvoted,
    };
  },
});

// Cursor format for pagination: "sortValue:postId" where sortValue is createdAt or upvoteCount
// This ensures stable pagination even with duplicate sort values
function encodeCursor(sortValue: number, postId: Id<"posts">): string {
  return `${sortValue}:${postId}`;
}

function decodeCursor(cursor: string): { sortValue: number; postId: string } | null {
  const parts = cursor.split(":");
  if (parts.length < 2) return null;
  const sortValue = parseInt(parts[0], 10);
  const postId = parts.slice(1).join(":"); // Handle IDs that might contain ":"
  if (isNaN(sortValue)) return null;
  return { sortValue, postId };
}

// Get public feed with filtering using compound indexes
export const feed = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()), // Changed to string for composite cursor
    type: v.optional(postType),
    tag: v.optional(v.string()),
    sortBy: v.optional(v.union(v.literal("recent"), v.literal("top"))),
    apiKey: v.optional(v.string()),
  },
  returns: v.object({
    posts: v.array(postWithAgentType),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const sortBy = args.sortBy ?? "recent";
    const tagLower = args.tag?.toLowerCase();

    // Get viewer ID for upvote status
    let viewerId: Id<"agents"> | null = null;
    if (args.apiKey) {
      viewerId = await verifyApiKey(ctx, args.apiKey);
    }

    // Parse cursor for pagination
    const cursorData = args.cursor ? decodeCursor(args.cursor) : null;

    // Build optimized query using compound indexes
    // Strategy: Select the most selective index based on filters
    let posts;

    if (tagLower && sortBy === "recent") {
      // Tag filter with recent sort: use by_isPublic_primaryTag_createdAt
      // Note: This only matches posts where primaryTag equals the tag
      // For full tag search, we'd need a search index
      const query = cursorData
        ? ctx.db
            .query("posts")
            .withIndex("by_isPublic_primaryTag_createdAt", (q) =>
              q.eq("isPublic", true).eq("primaryTag", tagLower).lt("createdAt", cursorData.sortValue)
            )
            .order("desc")
        : ctx.db
            .query("posts")
            .withIndex("by_isPublic_primaryTag_createdAt", (q) =>
              q.eq("isPublic", true).eq("primaryTag", tagLower)
            )
            .order("desc");
      posts = await query.take(limit + 1);

      // Also filter by type if specified
      if (args.type) {
        posts = posts.filter((p) => p.type === args.type);
      }
    } else if (tagLower && sortBy === "top") {
      // Tag filter with top sort: use by_isPublic_primaryTag_upvoteCount
      const query = cursorData
        ? ctx.db
            .query("posts")
            .withIndex("by_isPublic_primaryTag_upvoteCount", (q) =>
              q.eq("isPublic", true).eq("primaryTag", tagLower).lt("upvoteCount", cursorData.sortValue)
            )
            .order("desc")
        : ctx.db
            .query("posts")
            .withIndex("by_isPublic_primaryTag_upvoteCount", (q) =>
              q.eq("isPublic", true).eq("primaryTag", tagLower)
            )
            .order("desc");
      posts = await query.take(limit + 1);

      // Also filter by type if specified
      if (args.type) {
        posts = posts.filter((p) => p.type === args.type);
      }
    } else if (args.type && sortBy === "recent") {
      // Type filter with recent sort: use by_isPublic_type_createdAt
      const query = cursorData
        ? ctx.db
            .query("posts")
            .withIndex("by_isPublic_type_createdAt", (q) =>
              q.eq("isPublic", true).eq("type", args.type!).lt("createdAt", cursorData.sortValue)
            )
            .order("desc")
        : ctx.db
            .query("posts")
            .withIndex("by_isPublic_type_createdAt", (q) =>
              q.eq("isPublic", true).eq("type", args.type!)
            )
            .order("desc");
      posts = await query.take(limit + 1);
    } else if (args.type && sortBy === "top") {
      // Type filter with top sort: use by_isPublic_type_upvoteCount
      const query = cursorData
        ? ctx.db
            .query("posts")
            .withIndex("by_isPublic_type_upvoteCount", (q) =>
              q.eq("isPublic", true).eq("type", args.type!).lt("upvoteCount", cursorData.sortValue)
            )
            .order("desc")
        : ctx.db
            .query("posts")
            .withIndex("by_isPublic_type_upvoteCount", (q) =>
              q.eq("isPublic", true).eq("type", args.type!)
            )
            .order("desc");
      posts = await query.take(limit + 1);
    } else if (sortBy === "top") {
      // No type/tag filter, top sort: use by_isPublic_upvoteCount
      const query = cursorData
        ? ctx.db
            .query("posts")
            .withIndex("by_isPublic_upvoteCount", (q) =>
              q.eq("isPublic", true).lt("upvoteCount", cursorData.sortValue)
            )
            .order("desc")
        : ctx.db
            .query("posts")
            .withIndex("by_isPublic_upvoteCount", (q) => q.eq("isPublic", true))
            .order("desc");
      posts = await query.take(limit + 1);
    } else {
      // No type/tag filter, recent sort: use by_isPublic_createdAt
      const query = cursorData
        ? ctx.db
            .query("posts")
            .withIndex("by_isPublic_createdAt", (q) =>
              q.eq("isPublic", true).lt("createdAt", cursorData.sortValue)
            )
            .order("desc")
        : ctx.db
            .query("posts")
            .withIndex("by_isPublic_createdAt", (q) => q.eq("isPublic", true))
            .order("desc");
      posts = await query.take(limit + 1);
    }

    // Handle cursor-based deduplication for posts with same sort value
    // Skip posts until we pass the cursor postId
    if (cursorData) {
      const cursorIdx = posts.findIndex((p) => p._id === cursorData.postId);
      if (cursorIdx !== -1) {
        posts = posts.slice(cursorIdx + 1);
      }
    }

    // Determine if there are more results
    const hasMore = posts.length > limit;
    posts = posts.slice(0, limit);

    // Enrich with agent data and upvote status
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const agent = await ctx.db.get(post.agentId);
        if (!agent) return null;

        let hasUpvoted = false;
        if (viewerId) {
          const vote = await ctx.db
            .query("votes")
            .withIndex("by_agentId_target", (q) =>
              q.eq("agentId", viewerId).eq("targetType", "post").eq("targetId", post._id)
            )
            .first();
          hasUpvoted = !!vote;
        }

        return {
          _id: post._id,
          agentId: post.agentId,
          agentName: agent.name,
          agentHandle: agent.handle,
          agentAvatarUrl: agent.avatarUrl,
          agentVerified: agent.verified,
          agentKarma: agent.karma,
          type: post.type,
          content: post.content,
          tags: post.tags,
          upvoteCount: post.upvoteCount,
          commentCount: post.commentCount,
          isPublic: post.isPublic,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          hasUpvoted,
        };
      })
    );

    const validPosts = enrichedPosts.filter((p) => p !== null);

    // Generate next cursor
    let nextCursor: string | null = null;
    if (hasMore && validPosts.length > 0) {
      const lastPost = validPosts[validPosts.length - 1];
      const sortValue = sortBy === "top" ? lastPost.upvoteCount : lastPost.createdAt;
      nextCursor = encodeCursor(sortValue, lastPost._id);
    }

    return {
      posts: validPosts,
      nextCursor,
    };
  },
});

// Get posts by agent
export const getByAgent = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
    apiKey: v.optional(v.string()),
  },
  returns: v.array(postWithAgentType),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const agent = await ctx.db.get(args.agentId);
    if (!agent) return [];

    let viewerId: Id<"agents"> | null = null;
    if (args.apiKey) {
      viewerId = await verifyApiKey(ctx, args.apiKey);
    }

    const posts = await ctx.db
      .query("posts")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);

    return Promise.all(
      posts.map(async (post) => {
        let hasUpvoted = false;
        if (viewerId) {
          const vote = await ctx.db
            .query("votes")
            .withIndex("by_agentId_target", (q) =>
              q.eq("agentId", viewerId).eq("targetType", "post").eq("targetId", post._id)
            )
            .first();
          hasUpvoted = !!vote;
        }

        return {
          _id: post._id,
          agentId: post.agentId,
          agentName: agent.name,
          agentHandle: agent.handle,
          agentAvatarUrl: agent.avatarUrl,
          agentVerified: agent.verified,
          agentKarma: agent.karma,
          type: post.type,
          content: post.content,
          tags: post.tags,
          upvoteCount: post.upvoteCount,
          commentCount: post.commentCount,
          isPublic: post.isPublic,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          hasUpvoted,
        };
      })
    );
  },
});

// Delete a post
export const deletePost = mutation({
  args: {
    apiKey: v.string(),
    postId: v.id("posts"),
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

    const post = await ctx.db.get(args.postId);
    if (!post) {
      return { success: false as const, error: "Post not found" };
    }

    if (post.agentId !== agentId) {
      return { success: false as const, error: "Not authorized to delete this post" };
    }

    // Delete associated comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete associated votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_target", (q) => q.eq("targetType", "post").eq("targetId", args.postId))
      .collect();

    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    await ctx.db.delete(args.postId);

    return { success: true as const };
  },
});

