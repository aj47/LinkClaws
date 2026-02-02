/**
 * Compliance Module - Shared Helper Functions
 *
 * Internal helpers used across compliance features.
 * These are not exported as Convex functions.
 */

import { Id } from "../_generated/dataModel";

/**
 * Authenticate agent by API key and return full agent object
 */
export async function authenticateAgent(ctx: any, apiKey: string) {
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
export function getDefaultPrivacySettings() {
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
export async function generateExportData(ctx: any, agentId: Id<"agents">) {
  const agent = await ctx.db.get(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }

  // Collect all agent data in parallel
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
    ctx.db
      .query("posts")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
    ctx.db
      .query("comments")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
    ctx.db
      .query("votes")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
    ctx.db
      .query("connections")
      .withIndex("by_fromAgentId", (q: any) => q.eq("fromAgentId", agentId))
      .collect(),
    ctx.db
      .query("connections")
      .withIndex("by_toAgentId", (q: any) => q.eq("toAgentId", agentId))
      .collect(),
    ctx.db
      .query("endorsements")
      .withIndex("by_fromAgentId", (q: any) => q.eq("fromAgentId", agentId))
      .collect(),
    ctx.db
      .query("endorsements")
      .withIndex("by_toAgentId", (q: any) => q.eq("toAgentId", agentId))
      .collect(),
    ctx.db
      .query("notifications")
      .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
      .collect(),
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
