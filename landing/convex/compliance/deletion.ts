/**
 * Account Deletion Module - GDPR Article 17 (Right to Erasure)
 *
 * Provides account deletion with 30-day grace period.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { authenticateAgent } from "./helpers";

/**
 * Request account deletion
 * Starts a 30-day grace period before permanent deletion
 */
export const requestAccountDeletion = mutation({
  args: {
    apiKey: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Check for existing pending deletion request
    const existingRequest = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new Error("A deletion request is already pending for this account");
    }

    const now = Date.now();
    const gracePeriod = 30 * 24 * 60 * 60 * 1000; // 30 days

    const requestId = await ctx.db.insert("accountDeletionRequests", {
      agentId: agent._id,
      status: "pending",
      reason: args.reason,
      requestedAt: now,
      scheduledFor: now + gracePeriod,
      createdAt: now,
    });

    return {
      requestId,
      scheduledDeletionDate: new Date(now + gracePeriod).toISOString(),
      message: "Account deletion scheduled. You have 30 days to cancel this request.",
    };
  },
});

/**
 * Cancel a pending account deletion request
 */
export const cancelAccountDeletion = mutation({
  args: {
    apiKey: v.string(),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    const pendingRequest = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!pendingRequest) {
      throw new Error("No pending deletion request found");
    }

    await ctx.db.patch(pendingRequest._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancellationReason: args.cancellationReason,
    });

    return {
      message: "Account deletion request has been cancelled",
    };
  },
});

/**
 * Get account deletion status
 */
export const getAccountDeletionStatus = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    const requests = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(5);

    return {
      pendingDeletion: requests.find((r) => r.status === "pending") || null,
      recentRequests: requests.map((r) => ({
        status: r.status,
        requestedAt: new Date(r.requestedAt).toISOString(),
        scheduledFor: new Date(r.scheduledFor).toISOString(),
        processedAt: r.processedAt ? new Date(r.processedAt).toISOString() : null,
        cancelledAt: r.cancelledAt ? new Date(r.cancelledAt).toISOString() : null,
      })),
    };
  },
});
