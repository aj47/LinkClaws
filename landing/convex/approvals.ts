import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
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

// Shared helper to enrich a raw activityLog row with agent/org names
async function enrichItem(ctx: QueryCtx, item: Doc<"activityLog">) {
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
}

// List approvals by status: "pending" or "processed"
export const list = query({
  args: {
    sessionToken: v.string(),
    status: v.union(v.literal("pending"), v.literal("processed")),
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
    const orgId = args.organizationId ?? user.organizationId;

    // Cross-org access requires explicit superAdmin flag
    if (!orgId && user.superAdmin !== true) return [];

    const scanMultiplier = orgId ? 5 : 2;

    const allItems = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval")
      .filter((q) => q.eq(q.field("requiresApproval"), true))
      .order("desc")
      .take(limit * scanMultiplier);

    const isPending = args.status === "pending";
    let filtered = allItems.filter((item) =>
      isPending ? item.approved === undefined : item.approved !== undefined
    );
    if (orgId) {
      filtered = filtered.filter((item) => item.organizationId === orgId);
    }

    return Promise.all(filtered.slice(0, limit).map((item) => enrichItem(ctx, item)));
  },
});

// Process (approve or reject) an activity
export const process = mutation({
  args: {
    sessionToken: v.string(),
    activityId: v.id("activityLog"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
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

    if (activity.approved !== undefined) {
      return { success: false as const, error: "Activity has already been processed" };
    }

    // Org-scoped users can only process their own org's activities
    if (user.organizationId && activity.organizationId !== user.organizationId) {
      return { success: false as const, error: "Not authorized to process this activity" };
    }
    // Cross-org processing requires explicit superAdmin flag
    if (!user.organizationId && user.superAdmin !== true) {
      return { success: false as const, error: "Not authorized" };
    }

    await ctx.db.patch(args.activityId, {
      approved: args.decision === "approve",
      approvedAt: Date.now(),
      approvedBy: user.email,
    });

    return { success: true as const };
  },
});

// Get stats for dashboard (single scan)
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
    const empty = { pending: 0, approvedToday: 0, rejectedToday: 0, totalProcessed: 0 };

    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) return empty;

    const user = await ctx.db.get(userId);
    if (!user) return empty;

    const orgId = args.organizationId ?? user.organizationId;
    if (!orgId && user.superAdmin !== true) return empty;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();

    // Single scan over all requiresApproval items
    const MAX_SCAN = 1000;
    let items = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval", (q) => q.eq("requiresApproval", true))
      .order("desc")
      .take(MAX_SCAN);

    if (orgId) {
      items = items.filter((item) => item.organizationId === orgId);
    }

    let pending = 0;
    let approvedToday = 0;
    let rejectedToday = 0;
    let totalProcessed = 0;

    for (const item of items) {
      if (item.approved === undefined) {
        pending++;
      } else {
        totalProcessed++;
        const isToday = item.approvedAt && item.approvedAt >= startOfDayMs;
        if (item.approved && isToday) approvedToday++;
        if (!item.approved && isToday) rejectedToday++;
      }
    }

    return { pending, approvedToday, rejectedToday, totalProcessed };
  },
});
