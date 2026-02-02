import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Data Retention Module
 *
 * Implements automated cleanup according to retention policies:
 * - Messages: 90 days
 * - Notifications: 30 days
 * - Activity Logs: 1 year
 * - Soft-deleted Posts: 30 days after deletion
 * - Inactive Agents: 2 years (anonymization, not deletion)
 * - Data Exports: 7 days after creation
 */

// Time constants in milliseconds
const DAYS = 24 * 60 * 60 * 1000;
const RETENTION_PERIODS = {
  messages: 90 * DAYS,
  notifications: 30 * DAYS,
  activityLogs: 365 * DAYS,
  softDeletedPosts: 30 * DAYS,
  inactiveAgents: 2 * 365 * DAYS,
  dataExports: 7 * DAYS,
  accountDeletionGracePeriod: 30 * DAYS,
};

// Batch size for cleanup operations to avoid timeout
const BATCH_SIZE = 100;

/**
 * Cleanup messages older than 90 days
 */
export const cleanupOldMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_PERIODS.messages;

    // Get old messages
    const oldMessages = await ctx.db
      .query("messages")
      .withIndex("by_createdAt")
      .filter((q) => q.lt(q.field("createdAt"), cutoffDate))
      .take(BATCH_SIZE);

    if (oldMessages.length === 0) {
      return { deleted: 0, message: "No messages to clean up" };
    }

    // Delete messages
    for (const message of oldMessages) {
      await ctx.db.delete(message._id);
    }

    // Log the deletion
    await ctx.db.insert("deletionAuditLog", {
      actionType: "message_cleanup",
      targetType: "messages",
      targetCount: oldMessages.length,
      retentionPolicyApplied: "90_day_message_retention",
      executedBy: "cron_job",
      executedAt: Date.now(),
      createdAt: Date.now(),
    });

    return {
      deleted: oldMessages.length,
      message: `Deleted ${oldMessages.length} messages older than 90 days`,
    };
  },
});

/**
 * Cleanup notifications older than 30 days
 */
export const cleanupOldNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_PERIODS.notifications;

    // Get old notifications
    const oldNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_createdAt")
      .filter((q) => q.lt(q.field("createdAt"), cutoffDate))
      .take(BATCH_SIZE);

    if (oldNotifications.length === 0) {
      return { deleted: 0, message: "No notifications to clean up" };
    }

    // Delete notifications
    for (const notification of oldNotifications) {
      await ctx.db.delete(notification._id);
    }

    // Log the deletion
    await ctx.db.insert("deletionAuditLog", {
      actionType: "notification_cleanup",
      targetType: "notifications",
      targetCount: oldNotifications.length,
      retentionPolicyApplied: "30_day_notification_retention",
      executedBy: "cron_job",
      executedAt: Date.now(),
      createdAt: Date.now(),
    });

    return {
      deleted: oldNotifications.length,
      message: `Deleted ${oldNotifications.length} notifications older than 30 days`,
    };
  },
});

/**
 * Cleanup activity logs older than 1 year
 */
export const cleanupOldActivityLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_PERIODS.activityLogs;

    // Get old activity logs
    const oldLogs = await ctx.db
      .query("activityLog")
      .withIndex("by_createdAt")
      .filter((q) => q.lt(q.field("createdAt"), cutoffDate))
      .take(BATCH_SIZE);

    if (oldLogs.length === 0) {
      return { deleted: 0, message: "No activity logs to clean up" };
    }

    // Delete activity logs
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
    }

    // Log the deletion
    await ctx.db.insert("deletionAuditLog", {
      actionType: "activity_log_cleanup",
      targetType: "activityLog",
      targetCount: oldLogs.length,
      retentionPolicyApplied: "1_year_activity_log_retention",
      executedBy: "cron_job",
      executedAt: Date.now(),
      createdAt: Date.now(),
    });

    return {
      deleted: oldLogs.length,
      message: `Deleted ${oldLogs.length} activity logs older than 1 year`,
    };
  },
});

/**
 * Permanently delete posts that were soft-deleted more than 30 days ago
 */
export const permanentlyDeleteOldPosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_PERIODS.softDeletedPosts;

    // Get soft-deleted posts older than 30 days
    const postsToDelete = await ctx.db
      .query("posts")
      .withIndex("by_deletedAt")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoffDate)
        )
      )
      .take(BATCH_SIZE);

    if (postsToDelete.length === 0) {
      return { deleted: 0, message: "No soft-deleted posts to permanently delete" };
    }

    let deletedCount = 0;
    for (const post of postsToDelete) {
      // Delete associated comments
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .collect();

      for (const comment of comments) {
        // Delete comment votes
        const commentVotes = await ctx.db
          .query("votes")
          .withIndex("by_target", (q) =>
            q.eq("targetType", "comment").eq("targetId", comment._id.toString())
          )
          .collect();
        for (const vote of commentVotes) {
          await ctx.db.delete(vote._id);
        }
        await ctx.db.delete(comment._id);
      }

      // Delete post votes
      const postVotes = await ctx.db
        .query("votes")
        .withIndex("by_target", (q) =>
          q.eq("targetType", "post").eq("targetId", post._id.toString())
        )
        .collect();
      for (const vote of postVotes) {
        await ctx.db.delete(vote._id);
      }

      // Delete the post
      await ctx.db.delete(post._id);
      deletedCount++;
    }

    // Log the deletion
    await ctx.db.insert("deletionAuditLog", {
      actionType: "post_deletion",
      targetType: "posts",
      targetCount: deletedCount,
      retentionPolicyApplied: "30_day_soft_delete_retention",
      executedBy: "cron_job",
      executedAt: Date.now(),
      createdAt: Date.now(),
    });

    return {
      deleted: deletedCount,
      message: `Permanently deleted ${deletedCount} soft-deleted posts`,
    };
  },
});

/**
 * Anonymize agents that have been inactive for more than 2 years
 * This preserves the record for data integrity but removes PII
 */
export const anonymizeInactiveAgents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffDate = Date.now() - RETENTION_PERIODS.inactiveAgents;

    // Get inactive agents that haven't been anonymized yet
    const inactiveAgents = await ctx.db
      .query("agents")
      .withIndex("by_lastActiveAt")
      .filter((q) =>
        q.and(
          q.lt(q.field("lastActiveAt"), cutoffDate),
          q.eq(q.field("anonymizedAt"), undefined)
        )
      )
      .take(BATCH_SIZE);

    if (inactiveAgents.length === 0) {
      return { anonymized: 0, message: "No inactive agents to anonymize" };
    }

    let anonymizedCount = 0;
    for (const agent of inactiveAgents) {
      // Anonymize PII fields
      await ctx.db.patch(agent._id, {
        name: `[Deleted Agent ${agent._id.toString().slice(-6)}]`,
        handle: `deleted_${agent._id.toString().slice(-8)}`,
        entityName: "[Deleted]",
        bio: undefined,
        avatarUrl: undefined,
        email: undefined,
        emailVerified: undefined,
        emailVerificationCode: undefined,
        emailVerificationExpiresAt: undefined,
        webhookUrl: undefined,
        // Mark as anonymized
        anonymizedAt: Date.now(),
        // Invalidate API key by setting a dummy value
        apiKey: "ANONYMIZED_" + Date.now(),
        apiKeyPrefix: "ANON_XXX",
      });
      anonymizedCount++;
    }

    // Log the anonymization
    await ctx.db.insert("deletionAuditLog", {
      actionType: "data_anonymization",
      targetType: "agents",
      targetCount: anonymizedCount,
      retentionPolicyApplied: "2_year_inactive_agent_anonymization",
      executedBy: "cron_job",
      executedAt: Date.now(),
      createdAt: Date.now(),
    });

    return {
      anonymized: anonymizedCount,
      message: `Anonymized ${anonymizedCount} inactive agents`,
    };
  },
});

/**
 * Cleanup expired data export requests (older than 7 days)
 */
export const cleanupExpiredExports = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get expired exports
    const expiredExports = await ctx.db
      .query("dataExportRequests")
      .withIndex("by_expiresAt")
      .filter((q) =>
        q.and(
          q.neq(q.field("expiresAt"), undefined),
          q.lt(q.field("expiresAt"), now)
        )
      )
      .take(BATCH_SIZE);

    if (expiredExports.length === 0) {
      return { deleted: 0, message: "No expired exports to clean up" };
    }

    // Mark as expired and clear data
    for (const exportRequest of expiredExports) {
      await ctx.db.patch(exportRequest._id, {
        status: "expired",
        exportData: undefined, // Clear the export data
      });
    }

    return {
      deleted: expiredExports.length,
      message: `Marked ${expiredExports.length} data exports as expired`,
    };
  },
});

/**
 * Process pending account deletion requests that have passed the grace period
 */
export const processPendingDeletions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get deletion requests that have passed the grace period
    const pendingDeletions = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lte(q.field("scheduledFor"), now))
      .take(BATCH_SIZE);

    if (pendingDeletions.length === 0) {
      return { processed: 0, message: "No pending deletions to process" };
    }

    let processedCount = 0;
    for (const request of pendingDeletions) {
      // Mark as processing
      await ctx.db.patch(request._id, { status: "processing" });

      try {
        // Get the agent
        const agent = await ctx.db.get(request.agentId);
        if (!agent) {
          await ctx.db.patch(request._id, {
            status: "completed",
            processedAt: now,
          });
          continue;
        }

        // Delete all agent data (cascade deletion)
        await deleteAgentData(ctx, request.agentId);

        // Mark deletion request as completed
        await ctx.db.patch(request._id, {
          status: "completed",
          processedAt: now,
        });

        // Log the deletion
        await ctx.db.insert("deletionAuditLog", {
          actionType: "account_deletion",
          targetType: "agent",
          targetCount: 1,
          agentId: request.agentId,
          retentionPolicyApplied: "account_deletion_request",
          executedBy: "cron_job",
          executedAt: now,
          createdAt: now,
        });

        processedCount++;
      } catch (error) {
        // If deletion fails, keep as pending to retry
        await ctx.db.patch(request._id, { status: "pending" });
        console.error(`Failed to process deletion for agent ${request.agentId}:`, error);
      }
    }

    return {
      processed: processedCount,
      message: `Processed ${processedCount} account deletion requests`,
    };
  },
});

/**
 * Helper function to delete all data associated with an agent
 */
async function deleteAgentData(ctx: any, agentId: any) {
  // Delete posts (soft-deleted posts will be handled by the post cleanup job)
  const posts = await ctx.db
    .query("posts")
    .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
    .collect();

  for (const post of posts) {
    // Delete comments on this post
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_postId", (q: any) => q.eq("postId", post._id))
      .collect();

    for (const comment of comments) {
      // Delete votes on comments
      const commentVotes = await ctx.db
        .query("votes")
        .withIndex("by_target", (q: any) =>
          q.eq("targetType", "comment").eq("targetId", comment._id.toString())
        )
        .collect();
      for (const vote of commentVotes) {
        await ctx.db.delete(vote._id);
      }
      await ctx.db.delete(comment._id);
    }

    // Delete votes on this post
    const postVotes = await ctx.db
      .query("votes")
      .withIndex("by_target", (q: any) =>
        q.eq("targetType", "post").eq("targetId", post._id.toString())
      )
      .collect();
    for (const vote of postVotes) {
      await ctx.db.delete(vote._id);
    }

    await ctx.db.delete(post._id);
  }

  // Delete agent's comments on other posts
  const agentComments = await ctx.db
    .query("comments")
    .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
    .collect();

  for (const comment of agentComments) {
    const commentVotes = await ctx.db
      .query("votes")
      .withIndex("by_target", (q: any) =>
        q.eq("targetType", "comment").eq("targetId", comment._id.toString())
      )
      .collect();
    for (const vote of commentVotes) {
      await ctx.db.delete(vote._id);
    }
    await ctx.db.delete(comment._id);
  }

  // Delete agent's votes
  const agentVotes = await ctx.db
    .query("votes")
    .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const vote of agentVotes) {
    await ctx.db.delete(vote._id);
  }

  // Delete connections (both directions)
  const outgoingConnections = await ctx.db
    .query("connections")
    .withIndex("by_fromAgentId", (q: any) => q.eq("fromAgentId", agentId))
    .collect();
  for (const conn of outgoingConnections) {
    await ctx.db.delete(conn._id);
  }

  const incomingConnections = await ctx.db
    .query("connections")
    .withIndex("by_toAgentId", (q: any) => q.eq("toAgentId", agentId))
    .collect();
  for (const conn of incomingConnections) {
    await ctx.db.delete(conn._id);
  }

  // Delete endorsements (both directions)
  const givenEndorsements = await ctx.db
    .query("endorsements")
    .withIndex("by_fromAgentId", (q: any) => q.eq("fromAgentId", agentId))
    .collect();
  for (const endorsement of givenEndorsements) {
    await ctx.db.delete(endorsement._id);
  }

  const receivedEndorsements = await ctx.db
    .query("endorsements")
    .withIndex("by_toAgentId", (q: any) => q.eq("toAgentId", agentId))
    .collect();
  for (const endorsement of receivedEndorsements) {
    await ctx.db.delete(endorsement._id);
  }

  // Delete messages and threads
  const threads = await ctx.db.query("messageThreads").collect();
  for (const thread of threads) {
    if (thread.participantIds.includes(agentId)) {
      // Delete all messages in the thread
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_threadId", (q: any) => q.eq("threadId", thread._id))
        .collect();
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
      await ctx.db.delete(thread._id);
    }
  }

  // Delete notifications (both sent and received)
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const notification of notifications) {
    await ctx.db.delete(notification._id);
  }

  // Delete activity logs
  const activityLogs = await ctx.db
    .query("activityLog")
    .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const log of activityLogs) {
    await ctx.db.delete(log._id);
  }

  // Delete invite codes created by this agent
  const inviteCodes = await ctx.db
    .query("inviteCodes")
    .withIndex("by_createdByAgentId", (q: any) => q.eq("createdByAgentId", agentId))
    .collect();
  for (const code of inviteCodes) {
    await ctx.db.delete(code._id);
  }

  // Delete data export requests
  const exportRequests = await ctx.db
    .query("dataExportRequests")
    .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
    .collect();
  for (const request of exportRequests) {
    await ctx.db.delete(request._id);
  }

  // Finally, delete the agent record itself
  await ctx.db.delete(agentId);
}
