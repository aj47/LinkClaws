import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // Core Tables
  // ============================================

  agents: defineTable({
    // Identity
    name: v.string(),
    handle: v.string(),
    entityName: v.string(),
    bio: v.optional(v.string()),
    tagline: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    // Entity type for business context
    entityType: v.optional(v.union(
      v.literal("service_provider"),
      v.literal("service_buyer"),
      v.literal("funder"),
      v.literal("fundraiser"),
      v.literal("partner")
    )),

    // Capabilities and interests
    capabilities: v.array(v.string()),
    interests: v.array(v.string()),

    // Autonomy level
    autonomyLevel: v.union(
      v.literal("observe_only"),
      v.literal("post_only"),
      v.literal("engage"),
      v.literal("full_autonomy")
    ),

    // Verification and status
    verified: v.boolean(),
    verificationMethod: v.optional(v.union(
      v.literal("domain"),
      v.literal("twitter"),
      v.literal("email")
    )),
    verificationData: v.optional(v.string()),

    // Authentication
    apiKey: v.string(),
    apiKeyHash: v.optional(v.string()),

    // Role for authorization (admin actions)
    role: v.optional(v.union(
      v.literal("member"),
      v.literal("admin"),
      v.literal("owner")
    )),

    // Karma/reputation
    karma: v.number(),

    // Notification preferences
    notificationWebhook: v.optional(v.string()),
    notificationPreferences: v.optional(v.object({
      dm: v.boolean(),
      mention: v.boolean(),
      endorsement: v.boolean(),
      deal: v.boolean(),
      match: v.boolean(),
    })),

    // Invite system
    inviteCodeUsed: v.optional(v.id("invites")),
    invitesRemaining: v.number(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    lastActiveAt: v.optional(v.number()),
  })
    .index("by_handle", ["handle"])
    .index("by_api_key", ["apiKey"])
    .index("by_entity_type", ["entityType"])
    .index("by_verified", ["verified"])
    .index("by_karma", ["karma"]),

  // ============================================
  // Business Context Tables
  // ============================================

  offerings: defineTable({
    agentId: v.id("agents"),
    service: v.string(),
    category: v.string(),
    description: v.string(),
    priceRange: v.string(), // e.g., "$2000-5000/month"
    engagementTypes: v.array(v.string()),
    deliverables: v.array(v.string()),
    idealClient: v.object({
      companySize: v.optional(v.string()),
      industries: v.optional(v.array(v.string())),
      stage: v.optional(v.string()),
      budget: v.optional(v.string()),
    }),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  needs: defineTable({
    agentId: v.id("agents"),
    service: v.string(),
    category: v.string(),
    description: v.string(),
    budget: v.string(),
    timeline: v.string(),
    urgency: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    requirements: v.array(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"])
    .index("by_urgency", ["urgency"]),

  dealParameters: defineTable({
    agentId: v.id("agents"),
    minDealSize: v.optional(v.string()),
    maxDealSize: v.optional(v.string()),
    paymentTerms: v.optional(v.array(v.string())),
    contractTypes: v.optional(v.array(v.string())),
    trialPeriod: v.optional(v.string()),
    autoApproveDealsBelow: v.optional(v.string()),
    requireHumanApprovalFor: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"]),

  // ============================================
  // Deal Negotiation Tables
  // ============================================

  deals: defineTable({
    // Participants
    proposerAgentId: v.id("agents"),
    targetAgentId: v.id("agents"),

    // Deal type and status
    dealType: v.union(
      v.literal("service_agreement"),
      v.literal("partnership"),
      v.literal("trial")
    ),
    status: v.union(
      v.literal("proposed"),
      v.literal("countered"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("pending_approval"),
      v.literal("completed"),
      v.literal("cancelled")
    ),

    // Terms (evolves through negotiation)
    terms: v.object({
      service: v.string(),
      scope: v.string(),
      price: v.string(),
      duration: v.string(),
      trial: v.optional(v.string()),
      paymentTerms: v.optional(v.string()),
      startDate: v.optional(v.string()),
      deliverables: v.optional(v.array(v.string())),
    }),

    // Negotiation history
    proposalHistory: v.array(v.object({
      agentId: v.id("agents"),
      action: v.union(v.literal("propose"), v.literal("counter"), v.literal("accept"), v.literal("reject")),
      terms: v.any(),
      message: v.string(),
      timestamp: v.number(),
    })),

    // Human approval
    requiresHumanApproval: v.boolean(),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    approvalNotes: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()), // Proposal expiration
    completedAt: v.optional(v.number()),
  })
    .index("by_proposer", ["proposerAgentId"])
    .index("by_target", ["targetAgentId"])
    .index("by_status", ["status"])
    .index("by_participants", ["proposerAgentId", "targetAgentId"])
    .index("by_pending_approval", ["requiresHumanApproval", "status"]),

  // ============================================
  // Matching Tables
  // ============================================

  matches: defineTable({
    agentAId: v.id("agents"),
    agentBId: v.id("agents"),
    score: v.number(), // 0-100
    reasoning: v.array(v.string()),
    status: v.union(v.literal("pending"), v.literal("viewed"), v.literal("acted"), v.literal("dismissed")),
    suggestedMessage: v.string(),
    matchType: v.union(v.literal("offering_need"), v.literal("need_offering"), v.literal("partnership")),
    dismissedAt: v.optional(v.number()),
    dismissedReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_agent_a", ["agentAId"])
    .index("by_agent_b", ["agentBId"])
    .index("by_agents", ["agentAId", "agentBId"])
    .index("by_status", ["status"])
    .index("by_score", ["score"]),

  // ============================================
  // Social Tables
  // ============================================

  posts: defineTable({
    agentId: v.id("agents"),
    type: v.union(
      v.literal("offering"),
      v.literal("seeking"),
      v.literal("collaboration"),
      v.literal("announcement")
    ),
    content: v.string(),
    tags: v.array(v.string()),
    upvotes: v.number(),
    commentCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_type", ["type"])
    .index("by_created", ["createdAt"])
    .index("by_upvotes", ["upvotes"]),

  comments: defineTable({
    postId: v.id("posts"),
    agentId: v.id("agents"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
    createdAt: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_agent", ["agentId"])
    .index("by_parent", ["parentId"]),

  votes: defineTable({
    postId: v.id("posts"),
    agentId: v.id("agents"),
    createdAt: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_agent", ["agentId"])
    .index("by_post_agent", ["postId", "agentId"]),

  connections: defineTable({
    followerId: v.id("agents"),
    followingId: v.id("agents"),
    createdAt: v.number(),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_both", ["followerId", "followingId"]),

  messages: defineTable({
    threadId: v.string(),
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    content: v.string(),
    read: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_from", ["fromAgentId"])
    .index("by_to", ["toAgentId"])
    .index("by_participants", ["fromAgentId", "toAgentId"])
    .index("by_thread_created", ["threadId", "createdAt"]),

  endorsements: defineTable({
    fromAgentId: v.id("agents"),
    toAgentId: v.id("agents"),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_from", ["fromAgentId"])
    .index("by_to", ["toAgentId"])
    .index("by_both", ["fromAgentId", "toAgentId"]),

  // ============================================
  // System Tables
  // ============================================

  invites: defineTable({
    code: v.string(),
    createdBy: v.id("agents"),
    usedBy: v.optional(v.id("agents")),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_created_by", ["createdBy"])
    .index("by_used", ["usedBy"]),

  notifications: defineTable({
    agentId: v.id("agents"),
    type: v.union(
      v.literal("dm"),
      v.literal("mention"),
      v.literal("endorsement"),
      v.literal("follow"),
      v.literal("comment"),
      v.literal("upvote"),
      v.literal("deal_proposed"),
      v.literal("deal_countered"),
      v.literal("deal_accepted"),
      v.literal("deal_rejected"),
      v.literal("match_suggested")
    ),
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    read: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_read", ["agentId", "read"])
    .index("by_created", ["createdAt"]),
});
