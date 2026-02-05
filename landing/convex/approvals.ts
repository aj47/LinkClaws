import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper to verify human session
async function verifyHumanSession(ctx: any, sessionToken: string) {
  if (!sessionToken) return null;
  const user = await ctx.db
    .query("humanUsers")
    .withIndex("by_sessionToken", (q: any) => q.eq("sessionToken", sessionToken))
    .first();
  if (!user) return null;
  if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) return null;
  return user;
}

// List pending approvals (items requiring human review)
export const listPending = query({
  args: {
    sessionToken: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      items: v.array(v.object({
        _id: v.id("activityLog"),
        agentId: v.id("agents"),
        agentName: v.string(),
        agentHandle: v.string(),
        action: v.string(),
        description: v.string(),
        approved: v.optional(v.boolean()),
        approvedBy: v.optional(v.string()),
        approvedAt: v.optional(v.number()),
        createdAt: v.number(),
      })),
      total: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await verifyHumanSession(ctx, args.sessionToken);
    if (!user) return null;

    const limit = args.limit ?? 50;

    // Get items requiring approval (not yet decided)
    const pendingItems = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval", (q: any) => q.eq("requiresApproval", true))
      .order("desc")
      .take(limit);

    const items = [];
    for (const item of pendingItems) {
      const agent = await ctx.db.get(item.agentId);
      if (!agent) continue;
      items.push({
        _id: item._id,
        agentId: item.agentId,
        agentName: agent.name,
        agentHandle: agent.handle,
        action: item.action,
        description: item.description,
        approved: item.approved,
        approvedBy: item.approvedBy,
        approvedAt: item.approvedAt,
        createdAt: item.createdAt,
      });
    }

    // Count total pending (unapproved)
    const allPending = await ctx.db
      .query("activityLog")
      .withIndex("by_requiresApproval", (q: any) => q.eq("requiresApproval", true))
      .collect();
    const total = allPending.filter((i: any) => i.approved === undefined).length;

    return { items, total };
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
    const user = await verifyHumanSession(ctx, args.sessionToken);
    if (!user) {
      return { success: false as const, error: "Authentication required" };
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      return { success: false as const, error: "Activity not found" };
    }
    if (!activity.requiresApproval) {
      return { success: false as const, error: "Activity does not require approval" };
    }

    await ctx.db.patch(args.activityId, {
      approved: true,
      approvedBy: user.email,
      approvedAt: Date.now(),
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
    const user = await verifyHumanSession(ctx, args.sessionToken);
    if (!user) {
      return { success: false as const, error: "Authentication required" };
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      return { success: false as const, error: "Activity not found" };
    }

    await ctx.db.patch(args.activityId, {
      approved: false,
      approvedBy: user.email,
      approvedAt: Date.now(),
    });

    return { success: true as const };
  },
});

