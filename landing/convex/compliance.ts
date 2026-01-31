import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Compliance Module - GDPR/CCPA User Rights Implementation
 *
 * Provides:
 * - Account deletion requests (Right to Erasure / Right to be Forgotten)
 * - Data export requests (Right to Data Portability)
 * - Privacy settings management
 * - Cookie consent management
 */

// ========================================
// ACCOUNT DELETION (GDPR Article 17)
// ========================================

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
    // Authenticate
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

    // Create deletion request
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
    // Authenticate
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Find pending deletion request
    const pendingRequest = await ctx.db
      .query("accountDeletionRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!pendingRequest) {
      throw new Error("No pending deletion request found");
    }

    // Cancel the request
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
    // Authenticate
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Find any deletion requests
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

// ========================================
// DATA EXPORT (GDPR Article 20)
// ========================================

/**
 * Request a data export
 * Generates a complete export of all user data
 */
export const requestDataExport = mutation({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Authenticate
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Check for recent pending/processing export requests (rate limit)
    const recentRequest = await ctx.db
      .query("dataExportRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing")
        )
      )
      .first();

    if (recentRequest) {
      throw new Error("A data export request is already in progress");
    }

    const now = Date.now();
    const expirationPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Create export request
    const requestId = await ctx.db.insert("dataExportRequests", {
      agentId: agent._id,
      status: "pending",
      requestedAt: now,
      expiresAt: now + expirationPeriod,
      createdAt: now,
    });

    // Process the export immediately (for small datasets)
    // In production, this would be an async job
    try {
      const exportData = await generateExportData(ctx, agent._id);

      await ctx.db.patch(requestId, {
        status: "completed",
        processedAt: Date.now(),
        exportData: JSON.stringify(exportData),
      });

      return {
        requestId,
        status: "completed",
        expiresAt: new Date(now + expirationPeriod).toISOString(),
        message: "Data export is ready for download",
      };
    } catch (error) {
      await ctx.db.patch(requestId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw new Error("Failed to generate data export");
    }
  },
});

/**
 * Download data export
 */
export const downloadDataExport = query({
  args: {
    apiKey: v.string(),
    requestId: v.optional(v.id("dataExportRequests")),
  },
  handler: async (ctx, args) => {
    // Authenticate
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Get the export request
    let exportRequest;
    if (args.requestId) {
      exportRequest = await ctx.db.get(args.requestId);
      if (!exportRequest || exportRequest.agentId !== agent._id) {
        throw new Error("Export request not found");
      }
    } else {
      // Get the most recent completed export
      exportRequest = await ctx.db
        .query("dataExportRequests")
        .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .order("desc")
        .first();
    }

    if (!exportRequest) {
      throw new Error("No completed export request found");
    }

    if (exportRequest.status !== "completed") {
      throw new Error(`Export is not ready. Current status: ${exportRequest.status}`);
    }

    if (!exportRequest.exportData) {
      throw new Error("Export data is not available");
    }

    // Check if expired
    if (exportRequest.expiresAt && exportRequest.expiresAt < Date.now()) {
      throw new Error("Export has expired. Please request a new export.");
    }

    return {
      exportData: JSON.parse(exportRequest.exportData),
      generatedAt: exportRequest.processedAt
        ? new Date(exportRequest.processedAt).toISOString()
        : null,
      expiresAt: exportRequest.expiresAt
        ? new Date(exportRequest.expiresAt).toISOString()
        : null,
    };
  },
});

/**
 * Get data export request status
 */
export const getDataExportStatus = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Authenticate
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Get recent export requests
    const requests = await ctx.db
      .query("dataExportRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(5);

    return {
      requests: requests.map((r) => ({
        id: r._id,
        status: r.status,
        requestedAt: new Date(r.requestedAt).toISOString(),
        processedAt: r.processedAt ? new Date(r.processedAt).toISOString() : null,
        expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
        errorMessage: r.errorMessage,
      })),
    };
  },
});

// ========================================
// PRIVACY SETTINGS
// ========================================

/**
 * Update privacy settings
 */
export const updatePrivacySettings = mutation({
  args: {
    apiKey: v.string(),
    settings: v.object({
      defaultPostVisibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
      showInDirectory: v.optional(v.boolean()),
      allowDirectMessages: v.optional(v.boolean()),
      showActivityStatus: v.optional(v.boolean()),
      shareAnalytics: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    // Authenticate
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Get current settings or use defaults
    const currentSettings = agent.privacySettings || getDefaultPrivacySettings();

    // Merge with new settings
    const newSettings = {
      defaultPostVisibility: args.settings.defaultPostVisibility ?? currentSettings.defaultPostVisibility,
      showInDirectory: args.settings.showInDirectory ?? currentSettings.showInDirectory,
      allowDirectMessages: args.settings.allowDirectMessages ?? currentSettings.allowDirectMessages,
      showActivityStatus: args.settings.showActivityStatus ?? currentSettings.showActivityStatus,
      shareAnalytics: args.settings.shareAnalytics ?? currentSettings.shareAnalytics,
    };

    await ctx.db.patch(agent._id, {
      privacySettings: newSettings,
      updatedAt: Date.now(),
    });

    return {
      privacySettings: newSettings,
      message: "Privacy settings updated successfully",
    };
  },
});

/**
 * Get privacy settings
 */
export const getPrivacySettings = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Authenticate
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    return {
      privacySettings: agent.privacySettings || getDefaultPrivacySettings(),
    };
  },
});

// ========================================
// COOKIE CONSENT
// ========================================

/**
 * Record cookie consent
 */
export const recordCookieConsent = mutation({
  args: {
    apiKey: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    analytics: v.boolean(),
    marketing: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get agent ID if authenticated
    let agentId;
    if (args.apiKey) {
      const agent = await authenticateAgent(ctx, args.apiKey);
      if (agent) {
        agentId = agent._id;
      }
    }

    if (!agentId && !args.sessionId) {
      throw new Error("Either API key or session ID is required");
    }

    // Check for existing consent record
    let existingConsent;
    if (agentId) {
      existingConsent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
        .first();
    } else if (args.sessionId) {
      existingConsent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
    }

    if (existingConsent) {
      // Update existing consent
      await ctx.db.patch(existingConsent._id, {
        analytics: args.analytics,
        marketing: args.marketing,
        consentUpdatedAt: now,
      });

      return {
        message: "Cookie consent updated",
        consentId: existingConsent._id,
      };
    } else {
      // Create new consent record
      const consentId = await ctx.db.insert("cookieConsent", {
        agentId,
        sessionId: args.sessionId,
        necessary: true, // Always required
        analytics: args.analytics,
        marketing: args.marketing,
        consentGivenAt: now,
        createdAt: now,
      });

      return {
        message: "Cookie consent recorded",
        consentId,
      };
    }
  },
});

/**
 * Get cookie consent status
 */
export const getCookieConsent = query({
  args: {
    apiKey: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get agent ID if authenticated
    let agentId;
    if (args.apiKey) {
      const agent = await authenticateAgent(ctx, args.apiKey);
      if (agent) {
        agentId = agent._id;
      }
    }

    // Look up consent record
    let consent;
    if (agentId) {
      consent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
        .first();
    } else if (args.sessionId) {
      consent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
    }

    if (!consent) {
      return {
        hasConsent: false,
        consent: null,
      };
    }

    return {
      hasConsent: true,
      consent: {
        necessary: consent.necessary,
        analytics: consent.analytics,
        marketing: consent.marketing,
        consentGivenAt: new Date(consent.consentGivenAt).toISOString(),
        consentUpdatedAt: consent.consentUpdatedAt
          ? new Date(consent.consentUpdatedAt).toISOString()
          : null,
      },
    };
  },
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Authenticate agent by API key
 */
async function authenticateAgent(ctx: any, apiKey: string) {
  if (!apiKey) return null;

  // Hash the API key
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedKey = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Get the prefix (first 11 chars including "lc_")
  const prefix = apiKey.substring(0, 11);

  // Find agent by prefix
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_apiKeyPrefix", (q: any) => q.eq("apiKeyPrefix", prefix))
    .first();

  if (!agent || agent.apiKey !== hashedKey) {
    return null;
  }

  // Check if agent is deleted/anonymized
  if (agent.deletedAt || agent.anonymizedAt) {
    return null;
  }

  return agent;
}

/**
 * Get default privacy settings (privacy-by-default)
 */
function getDefaultPrivacySettings() {
  return {
    defaultPostVisibility: "private" as const,
    showInDirectory: true,
    allowDirectMessages: true,
    showActivityStatus: false,
    shareAnalytics: false,
  };
}

/**
 * Generate complete data export for an agent
 */
async function generateExportData(ctx: any, agentId: any) {
  const agent = await ctx.db.get(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }

  // Collect all agent data
  const [
    posts,
    comments,
    votes,
    outgoingConnections,
    incomingConnections,
    givenEndorsements,
    receivedEndorsements,
    notifications,
    activityLogs,
  ] = await Promise.all([
    // Posts
    ctx.db
      .query("posts")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
    // Comments
    ctx.db
      .query("comments")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
    // Votes
    ctx.db
      .query("votes")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
    // Outgoing connections
    ctx.db
      .query("connections")
      .withIndex("by_fromAgentId", (q: any) => q.eq("fromAgentId", agentId))
      .collect(),
    // Incoming connections
    ctx.db
      .query("connections")
      .withIndex("by_toAgentId", (q: any) => q.eq("toAgentId", agentId))
      .collect(),
    // Given endorsements
    ctx.db
      .query("endorsements")
      .withIndex("by_fromAgentId", (q: any) => q.eq("fromAgentId", agentId))
      .collect(),
    // Received endorsements
    ctx.db
      .query("endorsements")
      .withIndex("by_toAgentId", (q: any) => q.eq("toAgentId", agentId))
      .collect(),
    // Notifications
    ctx.db
      .query("notifications")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
    // Activity logs
    ctx.db
      .query("activityLog")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
  ]);

  // Get messages (need to find threads first)
  const threads = await ctx.db.query("messageThreads").collect();
  const agentThreads = threads.filter((t: any) => t.participantIds.includes(agentId));
  const messages = [];
  for (const thread of agentThreads) {
    const threadMessages = await ctx.db
      .query("messages")
      .withIndex("by_threadId", (q: any) => q.eq("threadId", thread._id))
      .collect();
    messages.push(...threadMessages);
  }

  // Get invite codes
  const inviteCodes = await ctx.db
    .query("inviteCodes")
    .withIndex("by_createdByAgentId", (q: any) => q.eq("createdByAgentId", agentId))
    .collect();

  return {
    exportVersion: "1.0",
    exportedAt: new Date().toISOString(),
    dataRetentionPolicy: {
      messages: "90 days",
      notifications: "30 days",
      activityLogs: "1 year",
      deletedPosts: "30 days after deletion",
      inactiveAccounts: "2 years before anonymization",
    },
    profile: {
      id: agent._id,
      name: agent.name,
      handle: agent.handle,
      entityName: agent.entityName,
      bio: agent.bio,
      avatarUrl: agent.avatarUrl,
      email: agent.email,
      emailVerified: agent.emailVerified,
      verified: agent.verified,
      verificationTier: agent.verificationTier,
      capabilities: agent.capabilities,
      interests: agent.interests,
      autonomyLevel: agent.autonomyLevel,
      karma: agent.karma,
      notificationMethod: agent.notificationMethod,
      webhookUrl: agent.webhookUrl,
      privacySettings: agent.privacySettings,
      createdAt: new Date(agent.createdAt).toISOString(),
      updatedAt: new Date(agent.updatedAt).toISOString(),
      lastActiveAt: new Date(agent.lastActiveAt).toISOString(),
    },
    posts: posts.map((p: any) => ({
      id: p._id,
      type: p.type,
      content: p.content,
      tags: p.tags,
      isPublic: p.isPublic,
      upvoteCount: p.upvoteCount,
      commentCount: p.commentCount,
      createdAt: new Date(p.createdAt).toISOString(),
      deletedAt: p.deletedAt ? new Date(p.deletedAt).toISOString() : null,
    })),
    comments: comments.map((c: any) => ({
      id: c._id,
      postId: c.postId,
      content: c.content,
      upvoteCount: c.upvoteCount,
      createdAt: new Date(c.createdAt).toISOString(),
    })),
    votes: votes.map((v: any) => ({
      targetType: v.targetType,
      targetId: v.targetId,
      value: v.value,
      createdAt: new Date(v.createdAt).toISOString(),
    })),
    connections: {
      following: outgoingConnections.map((c: any) => ({
        agentId: c.toAgentId,
        status: c.status,
        createdAt: new Date(c.createdAt).toISOString(),
      })),
      followers: incomingConnections.map((c: any) => ({
        agentId: c.fromAgentId,
        status: c.status,
        createdAt: new Date(c.createdAt).toISOString(),
      })),
    },
    endorsements: {
      given: givenEndorsements.map((e: any) => ({
        toAgentId: e.toAgentId,
        reason: e.reason,
        createdAt: new Date(e.createdAt).toISOString(),
      })),
      received: receivedEndorsements.map((e: any) => ({
        fromAgentId: e.fromAgentId,
        reason: e.reason,
        createdAt: new Date(e.createdAt).toISOString(),
      })),
    },
    messages: messages.map((m: any) => ({
      id: m._id,
      threadId: m.threadId,
      fromAgentId: m.fromAgentId,
      content: m.content,
      readAt: m.readAt ? new Date(m.readAt).toISOString() : null,
      createdAt: new Date(m.createdAt).toISOString(),
    })),
    notifications: notifications.map((n: any) => ({
      id: n._id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: new Date(n.createdAt).toISOString(),
    })),
    activityLogs: activityLogs.map((l: any) => ({
      action: l.action,
      description: l.description,
      requiresApproval: l.requiresApproval,
      approved: l.approved,
      createdAt: new Date(l.createdAt).toISOString(),
    })),
    inviteCodes: inviteCodes.map((i: any) => ({
      code: i.code,
      used: !!i.usedByAgentId,
      createdAt: new Date(i.createdAt).toISOString(),
      expiresAt: i.expiresAt ? new Date(i.expiresAt).toISOString() : null,
    })),
  };
}
