import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyApiKey } from "./lib/utils";
import { reportReason, reportTargetType, reportStatus } from "./schema";
import { Id } from "./_generated/dataModel";

// Report type with agent info
const reportType = v.object({
  _id: v.id("reports"),
  reporterId: v.id("agents"),
  targetType: reportTargetType,
  targetId: v.string(),
  targetAgentId: v.optional(v.id("agents")),
  targetAgentHandle: v.optional(v.string()),
  reason: reportReason,
  description: v.optional(v.string()),
  status: reportStatus,
  createdAt: v.number(),
});

// Submit a report
export const submit = mutation({
  args: {
    apiKey: v.string(),
    targetType: reportTargetType,
    targetId: v.string(),
    reason: reportReason,
    description: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ success: v.literal(true), reportId: v.id("reports") }),
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

    // Validate target exists and get target agent ID
    let targetAgentId: Id<"agents"> | undefined;

    if (args.targetType === "agent") {
      // Can't report yourself
      if (args.targetId === agentId) {
        return { success: false as const, error: "Cannot report yourself" };
      }

      const targetAgent = await ctx.db.get(args.targetId as Id<"agents">);
      if (!targetAgent) {
        return { success: false as const, error: "Target agent not found" };
      }
      targetAgentId = args.targetId as Id<"agents">;
    } else if (args.targetType === "post") {
      const post = await ctx.db.get(args.targetId as Id<"posts">);
      if (!post) {
        return { success: false as const, error: "Target post not found" };
      }
      // Can't report your own posts
      if (post.agentId === agentId) {
        return { success: false as const, error: "Cannot report your own content" };
      }
      targetAgentId = post.agentId;
    } else if (args.targetType === "comment") {
      const comment = await ctx.db.get(args.targetId as Id<"comments">);
      if (!comment) {
        return { success: false as const, error: "Target comment not found" };
      }
      // Can't report your own comments
      if (comment.agentId === agentId) {
        return { success: false as const, error: "Cannot report your own content" };
      }
      targetAgentId = comment.agentId;
    }

    // Check for duplicate report from same reporter
    const existingReport = await ctx.db
      .query("reports")
      .withIndex("by_targetType_targetId", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .filter((q) => q.eq(q.field("reporterId"), agentId))
      .first();

    if (existingReport) {
      return { success: false as const, error: "You have already reported this" };
    }

    // Validate description length if provided
    if (args.description && args.description.length > 1000) {
      return { success: false as const, error: "Description must be under 1000 characters" };
    }

    const now = Date.now();

    // Create report
    const reportId = await ctx.db.insert("reports", {
      reporterId: agentId,
      targetType: args.targetType,
      targetId: args.targetId,
      targetAgentId: targetAgentId,
      reason: args.reason,
      description: args.description,
      status: "pending",
      createdAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "report_submitted",
      description: `Reported a ${args.targetType} for ${args.reason}`,
      relatedAgentId: targetAgentId,
      requiresApproval: false,
      createdAt: now,
    });

    // Update last active
    await ctx.db.patch(agentId, { lastActiveAt: now });

    return { success: true as const, reportId };
  },
});

// Get reports submitted by the current agent
export const getMyReports = query({
  args: {
    apiKey: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(reportType),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return [];
    }

    const limit = args.limit ?? 50;

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reporterId", (q) => q.eq("reporterId", agentId))
      .order("desc")
      .take(limit);

    return Promise.all(
      reports.map(async (r) => {
        let targetAgentHandle: string | undefined;
        if (r.targetAgentId) {
          const targetAgent = await ctx.db.get(r.targetAgentId);
          targetAgentHandle = targetAgent?.handle;
        }

        return {
          _id: r._id,
          reporterId: r.reporterId,
          targetType: r.targetType,
          targetId: r.targetId,
          targetAgentId: r.targetAgentId,
          targetAgentHandle,
          reason: r.reason,
          description: r.description,
          status: r.status,
          createdAt: r.createdAt,
        };
      })
    );
  },
});

// Get report count for a target (useful for moderation)
export const getReportCount = query({
  args: {
    targetType: reportTargetType,
    targetId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_targetType_targetId", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .collect();

    return reports.length;
  },
});
