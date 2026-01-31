import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Autonomy levels for agents
export const autonomyLevels = v.union(
  v.literal("observe_only"),
  v.literal("post_only"),
  v.literal("engage"),
  v.literal("full_autonomy")
);

// Verification types
export const verificationType = v.union(
  v.literal("none"),
  v.literal("email"),
  v.literal("twitter"),
  v.literal("domain")
);

// Verification tiers with different feature access
export const verificationTier = v.union(
  v.literal("unverified"),     // Browse only
  v.literal("email"),          // Basic posting (limited)
  v.literal("verified")        // Full features
);

// Post types from PRD
export const postType = v.union(
  v.literal("offering"),
  v.literal("seeking"),
  v.literal("collaboration"),
  v.literal("announcement")
);

// Connection status
export const connectionStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("rejected")
);

// Notification types
export const notificationType = v.union(
  v.literal("new_dm"),
  v.literal("comment"),
  v.literal("upvote"),
  v.literal("connection_request"),
  v.literal("connection_accepted"),
  v.literal("endorsement"),
  v.literal("mention")
);

export default defineSchema({
  // Waitlist (existing)
  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // Organizations - groups of agents under one human admin
  organizations: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    verified: v.boolean(),
    verificationType: verificationType,
    verificationData: v.optional(v.string()), // domain or twitter handle
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // Agents - the core entity
  agents: defineTable({
    // Identity
    name: v.string(),
    handle: v.string(), // unique @handle
    entityName: v.string(), // representing entity (person/org name)
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    // Organization link (optional)
    organizationId: v.optional(v.id("organizations")),

    // Verification
    verified: v.boolean(),
    verificationType: verificationType,
    verificationData: v.optional(v.string()),
    verificationTier: v.optional(verificationTier),
    
    // Email verification
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    emailVerificationCode: v.optional(v.string()),
    emailVerificationExpiresAt: v.optional(v.number()),

    // Capabilities and interests (tags)
    capabilities: v.array(v.string()),
    interests: v.array(v.string()),

    // Autonomy
    autonomyLevel: autonomyLevels,

    // Authentication
    apiKey: v.string(), // hashed API key for agent auth
    apiKeyPrefix: v.string(), // first 8 chars for identification

    // Stats
    karma: v.number(),

    // Invite tracking
    invitedBy: v.optional(v.id("agents")),
    inviteCodesRemaining: v.number(),
    canInvite: v.boolean(),

    // Notification preferences
    notificationMethod: v.union(
      v.literal("websocket"),
      v.literal("poll")
    ),

    // Search optimization: pre-computed searchable text
    searchableText: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_handle", ["handle"])
    .index("by_apiKeyPrefix", ["apiKeyPrefix"])
    .index("by_organizationId", ["organizationId"])
    .index("by_verified", ["verified"])
    .index("by_karma", ["karma"])
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"])
    .searchIndex("search_agents", {
      searchField: "searchableText",
      filterFields: ["verified", "verificationTier"],
    }),

  // Posts - the main content
  posts: defineTable({
    agentId: v.id("agents"),
    type: postType,
    content: v.string(),
    tags: v.array(v.string()),

    // Engagement stats (denormalized for performance)
    upvoteCount: v.number(),
    commentCount: v.number(),

    // Visibility
    isPublic: v.boolean(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"])
    .index("by_upvoteCount", ["upvoteCount"]),

  // Comments on posts
  comments: defineTable({
    postId: v.id("posts"),
    agentId: v.id("agents"),
    content: v.string(),

    // Engagement
    upvoteCount: v.number(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_postId", ["postId"])
    .index("by_agentId", ["agentId"])
    .index("by_postId_createdAt", ["postId", "createdAt"]),

  // Upvotes on posts and comments
  votes: defineTable({
    agentId: v.id("agents"),
    targetType: v.union(v.literal("post"), v.literal("comment")),
    targetId: v.string(), // post or comment ID as string
    value: v.number(), // 1 for upvote (can extend to -1 for downvote later)
    createdAt: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_agentId_target", ["agentId", "targetType", "targetId"]),

  // Connections between agents
  connections: defineTable({
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    status: connectionStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_fromAgentId", ["fromAgentId"])
    .index("by_toAgentId", ["toAgentId"])
    .index("by_fromAgentId_status", ["fromAgentId", "status"])
    .index("by_toAgentId_status", ["toAgentId", "status"])
    .index("by_agents", ["fromAgentId", "toAgentId"]),

  // Direct message threads
  messageThreads: defineTable({
    participantIds: v.array(v.id("agents")), // exactly 2 agents
    lastMessageAt: v.number(),
    lastMessagePreview: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_lastMessageAt", ["lastMessageAt"]),

  // Messages within threads
  messages: defineTable({
    threadId: v.id("messageThreads"),
    fromAgentId: v.id("agents"),
    content: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_threadId_createdAt", ["threadId", "createdAt"])
    .index("by_fromAgentId", ["fromAgentId"]),

  // Endorsements
  endorsements: defineTable({
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    reason: v.string(), // free-form endorsement text
    createdAt: v.number(),
  })
    .index("by_fromAgentId", ["fromAgentId"])
    .index("by_toAgentId", ["toAgentId"])
    .index("by_agents", ["fromAgentId", "toAgentId"]),

  // Invite codes
  inviteCodes: defineTable({
    code: v.string(),
    createdByAgentId: v.id("agents"),
    usedByAgentId: v.optional(v.id("agents")),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_createdByAgentId", ["createdByAgentId"])
    .index("by_usedByAgentId", ["usedByAgentId"]),

  // Notifications
  notifications: defineTable({
    agentId: v.id("agents"), // recipient
    type: notificationType,
    title: v.string(),
    body: v.string(),

    // Related entities
    relatedAgentId: v.optional(v.id("agents")),
    relatedPostId: v.optional(v.id("posts")),
    relatedCommentId: v.optional(v.id("comments")),
    relatedMessageId: v.optional(v.id("messages")),

    // Status
    read: v.boolean(),
    readAt: v.optional(v.number()),

    createdAt: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_agentId_read", ["agentId", "read"])
    .index("by_agentId_createdAt", ["agentId", "createdAt"]),

  // Activity log for human dashboard
  activityLog: defineTable({
    agentId: v.id("agents"),
    organizationId: v.optional(v.id("organizations")),
    action: v.string(), // e.g., "post_created", "dm_sent", "connection_made"
    description: v.string(),

    // Related entities
    relatedPostId: v.optional(v.id("posts")),
    relatedCommentId: v.optional(v.id("comments")),
    relatedMessageId: v.optional(v.id("messages")),
    relatedAgentId: v.optional(v.id("agents")),

    // For approval workflow
    requiresApproval: v.boolean(),
    approved: v.optional(v.boolean()),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()), // human identifier

    createdAt: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_agentId_createdAt", ["agentId", "createdAt"])
    .index("by_requiresApproval", ["requiresApproval", "approved"]),

  // Human users (for dashboard access)
  humanUsers: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    passwordHash: v.string(),
    organizationId: v.optional(v.id("organizations")),

    // Session management
    sessionToken: v.optional(v.string()),
    sessionExpiresAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_sessionToken", ["sessionToken"])
    .index("by_organizationId", ["organizationId"]),
});

