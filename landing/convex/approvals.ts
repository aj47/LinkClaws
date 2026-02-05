import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyHumanSession } from "./humanUsers";

// Type for approval items
const approvalItemType = v.object({
  _id: v.id("activityLog"),
  agentId: v.id("agents"),
  agentName: v.string(),
  agentHandle: v.string(),
  organizationId: v.optional(v.id("organizations")),
  organizationName: v.optional(v.string()),
  action: v.string(),
  description: v.string(),
  relatedPostId: v.optional(v.id("posts")),
  relatedCommentId: v.optional(v.id("comments")),
  relatedMessageId: v.optional(v.id("messages")),
  relatedAgentId: v.optional(v.id("agents")),
  relatedAgentHandle: v.optional(v.string()),
  requiresApproval: v.optional(v.boolean()),
  approved: v.optional(v.boolean()),
  approvedAt: v.optional(v.number()),
  approvedBy: v.optional(v.string()),
  createdAt: v.number(),
});

// Get pending approvals
export const getPending = query({
  args: {
    sessionToken: v.string(),
    organizationId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
  },
  returns: v.array(approvalItemType),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user) return [];

    const limit = args.limit ?? 50;

    // Note: Users without an organizationId see approvals across all organizations
    // (intentional super-admin behavior for platform-level oversight).
    const orgId = args.organizationId ?? user.organizationId;

    // Use a larger scan window to account for JS-side filtering by org/status,
    // reducing the chance of returning fewer than `limit` results.
    const scanMultiplier = orgId ? 5 : 2;

    // Get items requiring approval that haven't been processed
    const allItems = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval")
      .filter((q) => q.eq(q.field("requiresApproval"), true))
      .order("desc")
      .take(limit * scanMultiplier);

    // Filter to pending items (approved is undefined) and by organization
    let pendingItems = allItems.filter((item) => item.approved === undefined);
    if (orgId) {
      pendingItems = pendingItems.filter((item) => item.organizationId === orgId);
    }

    const result = await Promise.all(
      pendingItems.slice(0, limit).map(async (item) => {
        const agent = await ctx.db.get(item.agentId);
        let orgName: string | undefined;
        if (item.organizationId) {
          const org = await ctx.db.get(item.organizationId);
          orgName = org?.name;
        }
        let relatedAgentHandle: string | undefined;
        if (item.relatedAgentId) {
          const relAgent = await ctx.db.get(item.relatedAgentId);
          relatedAgentHandle = relAgent?.handle;
        }

        return {
          _id: item._id,
          agentId: item.agentId,
          agentName: agent?.name ?? "Unknown",
          agentHandle: agent?.handle ?? "unknown",
          organizationId: item.organizationId,
          organizationName: orgName,
          action: item.action,
          description: item.description,
          relatedPostId: item.relatedPostId,
          relatedCommentId: item.relatedCommentId,
          relatedMessageId: item.relatedMessageId,
          relatedAgentId: item.relatedAgentId,
          relatedAgentHandle,
          requiresApproval: item.requiresApproval,
          approved: item.approved,
          approvedAt: item.approvedAt,
          approvedBy: item.approvedBy,
          createdAt: item.createdAt,
        };
      })
    );

    return result;
  },
});

// Approve an activity
export const approve = mutation({
  args: {
    sessionToken: v.string(),
    activityId: v.id("activityLog"),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { success: false as const, error: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false as const, error: "User not found" };
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      return { success: false as const, error: "Activity not found" };
    }

    if (!activity.requiresApproval) {
      return { success: false as const, error: "Activity does not require approval" };
    }

    // Prevent overwriting already-processed activities to preserve audit trail
    if (activity.approved !== undefined) {
      return { success: false as const, error: "Activity has already been processed" };
    }

    if (activity.organizationId && user.organizationId !== activity.organizationId) {
      return { success: false as const, error: "Not authorized to approve this activity" };
    }

    await ctx.db.patch(args.activityId, {
      approved: true,
      approvedAt: Date.now(),
      approvedBy: user.email,
    });

    return { success: true as const };
  },
});

// Reject an activity
export const reject = mutation({
  args: {
    sessionToken: v.string(),
    activityId: v.id("activityLog"),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { success: false as const, error: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false as const, error: "User not found" };
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      return { success: false as const, error: "Activity not found" };
    }

    if (!activity.requiresApproval) {
      return { success: false as const, error: "Activity does not require approval" };
    }

    // Prevent overwriting already-processed activities to preserve audit trail
    if (activity.approved !== undefined) {
      return { success: false as const, error: "Activity has already been processed" };
    }

    if (activity.organizationId && user.organizationId !== activity.organizationId) {
      return { success: false as const, error: "Not authorized to reject this activity" };
    }

    await ctx.db.patch(args.activityId, {
      approved: false,
      approvedAt: Date.now(),
      approvedBy: user.email,
    });

    return { success: true as const };
  },
});

// Get approval history (recently processed)
export const getHistory = query({
  args: {
    sessionToken: v.string(),
    organizationId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
  },
  returns: v.array(approvalItemType),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user) return [];

    const limit = args.limit ?? 50;

    // Note: Users without an organizationId see history across all organizations
    // (intentional super-admin behavior for platform-level oversight).
    const orgId = args.organizationId ?? user.organizationId;

    // Use a larger scan window to account for JS-side filtering by org/status
    const scanMultiplier = orgId ? 5 : 3;

    // Get items that have been processed (approved is defined)
    const allItems = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval")
      .filter((q) => q.eq(q.field("requiresApproval"), true))
      .order("desc")
      .take(limit * scanMultiplier);

    // Filter to only processed items and by organization
    let processedItems = allItems.filter((item) => item.approved !== undefined);
    if (orgId) {
      processedItems = processedItems.filter((item) => item.organizationId === orgId);
    }

    const result = await Promise.all(
      processedItems.slice(0, limit).map(async (item) => {
        const agent = await ctx.db.get(item.agentId);
        let orgName: string | undefined;
        if (item.organizationId) {
          const org = await ctx.db.get(item.organizationId);
          orgName = org?.name;
        }
        let relatedAgentHandle: string | undefined;
        if (item.relatedAgentId) {
          const relAgent = await ctx.db.get(item.relatedAgentId);
          relatedAgentHandle = relAgent?.handle;
        }

        return {
          _id: item._id,
          agentId: item.agentId,
          agentName: agent?.name ?? "Unknown",
          agentHandle: agent?.handle ?? "unknown",
          organizationId: item.organizationId,
          organizationName: orgName,
          action: item.action,
          description: item.description,
          relatedPostId: item.relatedPostId,
          relatedCommentId: item.relatedCommentId,
          relatedMessageId: item.relatedMessageId,
          relatedAgentId: item.relatedAgentId,
          relatedAgentHandle,
          requiresApproval: item.requiresApproval,
          approved: item.approved,
          approvedAt: item.approvedAt,
          approvedBy: item.approvedBy,
          createdAt: item.createdAt,
        };
      })
    );

    return result;
  },
});

// Get stats for dashboard
export const getStats = query({
  args: {
    sessionToken: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.object({
    pending: v.number(),
    approvedToday: v.number(),
    rejectedToday: v.number(),
    totalProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { pending: 0, approvedToday: 0, rejectedToday: 0, totalProcessed: 0 };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { pending: 0, approvedToday: 0, rejectedToday: 0, totalProcessed: 0 };
    }

    // Note: Users without an organizationId see stats across all organizations
    // (intentional super-admin behavior for platform-level oversight).
    const orgId = args.organizationId ?? user.organizationId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();

    // Bounded queries using the composite index to avoid unbounded collection scans.
    // Note: Counts are approximate once rows exceed MAX_SCAN per category.
    // For exact counts at scale, consider a dedicated counters table.
    const MAX_SCAN = 1000;

    // Get pending items (requiresApproval=true, approved is undefined)
    // Order desc so newest items are scanned first (important for "today" counts)
    let pendingItems = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval", (q) => q.eq("requiresApproval", true))
      .filter((q) => q.eq(q.field("approved"), undefined))
      .order("desc")
      .take(MAX_SCAN);

    // Get approved items (requiresApproval=true, approved=true)
    let approvedItems = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval", (q) =>
        q.eq("requiresApproval", true).eq("approved", true)
      )
      .order("desc")
      .take(MAX_SCAN);

    // Get rejected items (requiresApproval=true, approved=false)
    let rejectedItems = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval", (q) =>
        q.eq("requiresApproval", true).eq("approved", false)
      )
      .order("desc")
      .take(MAX_SCAN);

    // Filter by organization if needed
    if (orgId) {
      pendingItems = pendingItems.filter((item) => item.organizationId === orgId);
      approvedItems = approvedItems.filter((item) => item.organizationId === orgId);
      rejectedItems = rejectedItems.filter((item) => item.organizationId === orgId);
    }

    const pending = pendingItems.length;
    const approvedToday = approvedItems.filter(
      (item) => item.approvedAt && item.approvedAt >= startOfDayMs
    ).length;
    const rejectedToday = rejectedItems.filter(
      (item) => item.approvedAt && item.approvedAt >= startOfDayMs
    ).length;
    const totalProcessed = approvedItems.length + rejectedItems.length;

    return { pending, approvedToday, rejectedToday, totalProcessed };
  },
});
