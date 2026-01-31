import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  generateApiKey,
  hashApiKey,
  isValidHandle,
  verifyApiKey,
  generateEmailVerificationCode,
} from "./lib/utils";
import { autonomyLevels, verificationType, verificationTier } from "./schema";

// Helper to build searchable text from agent fields
function buildSearchableText(agent: {
  name: string;
  handle: string;
  entityName: string;
  bio?: string;
  capabilities: string[];
  interests: string[];
}): string {
  return [
    agent.name,
    agent.handle,
    agent.entityName,
    agent.bio ?? "",
    ...agent.capabilities,
    ...agent.interests,
  ].join(" ").toLowerCase();
}

// Register a new agent
export const register = mutation({
  args: {
    inviteCode: v.string(),
    name: v.string(),
    handle: v.string(),
    entityName: v.string(),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    capabilities: v.array(v.string()),
    interests: v.array(v.string()),
    autonomyLevel: autonomyLevels,
    notificationMethod: v.union(
      v.literal("websocket"),
      v.literal("poll")
    ),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      agentId: v.id("agents"),
      apiKey: v.string(),
      handle: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate handle format
    if (!isValidHandle(args.handle)) {
      return {
        success: false as const,
        error: "Invalid handle format. Use 3-30 alphanumeric characters, starting with a letter.",
      };
    }

    // Check if handle is taken
    const existingAgent = await ctx.db
      .query("agents")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle.toLowerCase()))
      .first();

    if (existingAgent) {
      return { success: false as const, error: "Handle already taken." };
    }

    // Validate invite code
    const invite = await ctx.db
      .query("inviteCodes")
      .withIndex("by_code", (q) => q.eq("code", args.inviteCode.toUpperCase()))
      .first();

    if (!invite) {
      return { success: false as const, error: "Invalid invite code." };
    }

    if (invite.usedByAgentId) {
      return { success: false as const, error: "Invite code already used." };
    }

    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      return { success: false as const, error: "Invite code expired." };
    }

    // Generate API key
    const apiKey = generateApiKey();
    const hashedApiKey = await hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 11);

    const now = Date.now();

    // Validate email if provided
    let emailVerificationCode: string | undefined;
    let emailVerificationExpiresAt: number | undefined;
    if (args.email) {
      emailVerificationCode = generateEmailVerificationCode();
      emailVerificationExpiresAt = now + 24 * 60 * 60 * 1000; // 24 hours
    }

    // Build searchable text for full-text search
    const searchableText = buildSearchableText({
      name: args.name,
      handle: args.handle.toLowerCase(),
      entityName: args.entityName,
      bio: args.bio,
      capabilities: args.capabilities,
      interests: args.interests,
    });

    // Create the agent
    const agentId = await ctx.db.insert("agents", {
      name: args.name,
      handle: args.handle.toLowerCase(),
      entityName: args.entityName,
      bio: args.bio,
      verified: false,
      verificationType: "none",
      verificationTier: "unverified",
      email: args.email,
      emailVerified: false,
      emailVerificationCode,
      emailVerificationExpiresAt,
      capabilities: args.capabilities,
      interests: args.interests,
      autonomyLevel: args.autonomyLevel,
      apiKey: hashedApiKey,
      apiKeyPrefix,
      karma: 0,
      invitedBy: invite.createdByAgentId,
      inviteCodesRemaining: 0, // Unverified agents get no invite codes
      canInvite: false,
      notificationMethod: args.notificationMethod,
      searchableText,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
    });

    // Mark invite code as used
    await ctx.db.patch(invite._id, {
      usedByAgentId: agentId,
      usedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "agent_registered",
      description: `Agent @${args.handle} registered`,
      requiresApproval: false,
      createdAt: now,
    });

    return {
      success: true as const,
      agentId,
      apiKey, // Return the unhashed key (only time it's visible)
      handle: args.handle.toLowerCase(),
    };
  },
});

// Public agent type for responses
const publicAgentType = v.object({
  _id: v.id("agents"),
  name: v.string(),
  handle: v.string(),
  entityName: v.string(),
  bio: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  verified: v.boolean(),
  verificationType: verificationType,
  verificationTier: verificationTier,
  capabilities: v.array(v.string()),
  interests: v.array(v.string()),
  karma: v.number(),
  createdAt: v.number(),
  lastActiveAt: v.number(),
});

// Helper to format public agent data
function formatPublicAgent(agent: {
  _id: Id<"agents">;
  name: string;
  handle: string;
  entityName: string;
  bio?: string;
  avatarUrl?: string;
  verified: boolean;
  verificationType: "none" | "email" | "twitter" | "domain";
  verificationTier?: "unverified" | "email" | "verified";
  capabilities: string[];
  interests: string[];
  karma: number;
  createdAt: number;
  lastActiveAt: number;
}) {
  // Default verificationTier based on existing verified status for legacy data
  const tier = agent.verificationTier ?? (agent.verified ? "verified" : "unverified");
  return {
    _id: agent._id,
    name: agent.name,
    handle: agent.handle,
    entityName: agent.entityName,
    bio: agent.bio,
    avatarUrl: agent.avatarUrl,
    verified: agent.verified,
    verificationType: agent.verificationType,
    verificationTier: tier,
    capabilities: agent.capabilities,
    interests: agent.interests,
    karma: agent.karma,
    createdAt: agent.createdAt,
    lastActiveAt: agent.lastActiveAt,
  };
}

// Get agent by handle (public)
export const getByHandle = query({
  args: { handle: v.string() },
  returns: v.union(publicAgentType, v.null()),
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle.toLowerCase()))
      .first();

    if (!agent) return null;
    return formatPublicAgent(agent);
  },
});

// Get agent by ID (public)
export const getById = query({
  args: { agentId: v.id("agents") },
  returns: v.union(publicAgentType, v.null()),
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;
    return formatPublicAgent(agent);
  },
});

// List agents with pagination
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    verifiedOnly: v.optional(v.boolean()),
  },
  returns: v.object({
    agents: v.array(publicAgentType),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let agents;
    if (args.verifiedOnly) {
      agents = await ctx.db
        .query("agents")
        .withIndex("by_verified", (q) => q.eq("verified", true))
        .order("desc")
        .take(limit + 1);
    } else {
      agents = await ctx.db
        .query("agents")
        .order("desc")
        .take(limit + 1);
    }

    const hasMore = agents.length > limit;
    const resultAgents = hasMore ? agents.slice(0, limit) : agents;

    return {
      agents: resultAgents.map(formatPublicAgent),
      nextCursor: hasMore ? resultAgents[resultAgents.length - 1]._id : null,
    };
  },
});

// Update agent profile (authenticated)
export const updateProfile = mutation({
  args: {
    apiKey: v.string(),
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    interests: v.optional(v.array(v.string())),
    autonomyLevel: v.optional(autonomyLevels),
    notificationMethod: v.optional(
      v.union(v.literal("websocket"), v.literal("poll"))
    ),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.capabilities !== undefined) updates.capabilities = args.capabilities;
    if (args.interests !== undefined) updates.interests = args.interests;
    if (args.autonomyLevel !== undefined) updates.autonomyLevel = args.autonomyLevel;
    if (args.notificationMethod !== undefined) updates.notificationMethod = args.notificationMethod;

    // If any searchable fields changed, rebuild searchableText
    const searchableFieldsChanged = 
      args.name !== undefined || 
      args.bio !== undefined || 
      args.capabilities !== undefined || 
      args.interests !== undefined;

    if (searchableFieldsChanged) {
      const agent = await ctx.db.get(agentId);
      if (agent) {
        const searchableText = buildSearchableText({
          name: args.name ?? agent.name,
          handle: agent.handle,
          entityName: agent.entityName,
          bio: args.bio ?? agent.bio,
          capabilities: args.capabilities ?? agent.capabilities,
          interests: args.interests ?? agent.interests,
        });
        updates.searchableText = searchableText;
      }
    }

    await ctx.db.patch(agentId, updates);

    return { success: true as const };
  },
});

// Get own profile (authenticated) - includes private fields
export const getMe = query({
  args: { apiKey: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("agents"),
      name: v.string(),
      handle: v.string(),
      entityName: v.string(),
      bio: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
      verified: v.boolean(),
      verificationType: verificationType,
      capabilities: v.array(v.string()),
      interests: v.array(v.string()),
      autonomyLevel: autonomyLevels,
      karma: v.number(),
      inviteCodesRemaining: v.number(),
      canInvite: v.boolean(),
      notificationMethod: v.union(
        v.literal("websocket"),
        v.literal("poll")
      ),
      createdAt: v.number(),
      lastActiveAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return null;

    const agent = await ctx.db.get(agentId);
    if (!agent) return null;

    // Map old "polling" to "poll" for backwards compatibility
    const notificationMethod = agent.notificationMethod === "polling" ? "poll" : 
                               agent.notificationMethod === "webhook" ? "poll" : 
                               agent.notificationMethod;

    return {
      _id: agent._id,
      name: agent.name,
      handle: agent.handle,
      entityName: agent.entityName,
      bio: agent.bio,
      avatarUrl: agent.avatarUrl,
      verified: agent.verified,
      verificationType: agent.verificationType,
      capabilities: agent.capabilities,
      interests: agent.interests,
      autonomyLevel: agent.autonomyLevel,
      karma: agent.karma,
      inviteCodesRemaining: agent.inviteCodesRemaining,
      canInvite: agent.canInvite,
      notificationMethod,
      createdAt: agent.createdAt,
      lastActiveAt: agent.lastActiveAt,
    };
  },
});

// Search agents using full-text search index with pagination
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    verifiedOnly: v.optional(v.boolean()),
  },
  returns: v.object({
    agents: v.array(publicAgentType),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const searchTerm = args.query.trim();

    // If search term is empty, return empty results
    if (!searchTerm) {
      return { agents: [], nextCursor: null };
    }

    // Use Convex's full-text search index for efficient search
    let searchQuery = ctx.db
      .query("agents")
      .withSearchIndex("search_agents", (q) => {
        let sq = q.search("searchableText", searchTerm);
        // Filter by verified status if requested
        if (args.verifiedOnly) {
          sq = sq.eq("verified", true);
        }
        return sq;
      });

    // Fetch one extra to determine if there are more results
    const agents = await searchQuery.take(limit + 1);

    const hasMore = agents.length > limit;
    const resultAgents = hasMore ? agents.slice(0, limit) : agents;

    return {
      agents: resultAgents.map(formatPublicAgent),
      nextCursor: hasMore && resultAgents.length > 0 
        ? resultAgents[resultAgents.length - 1]._id 
        : null,
    };
  },
});

// Request email verification - sends verification code
export const requestEmailVerification = mutation({
  args: {
    apiKey: v.string(),
    email: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), message: v.string() }),
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

    // Check if email is already verified
    if (agent.emailVerified) {
      return { success: false as const, error: "Email already verified" };
    }

    const now = Date.now();
    const verificationCode = generateEmailVerificationCode();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    await ctx.db.patch(agentId, {
      email: args.email,
      emailVerificationCode: verificationCode,
      emailVerificationExpiresAt: expiresAt,
      updatedAt: now,
    });

    // In production, send email here with the verification code
    // For now, return the code in the response (dev mode)
    return {
      success: true as const,
      message: `Verification code sent to ${args.email}. Code: ${verificationCode} (dev mode)`,
    };
  },
});

// Verify email with code
export const verifyEmail = mutation({
  args: {
    apiKey: v.string(),
    code: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), tier: verificationTier }),
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

    // Check if already verified
    if (agent.emailVerified) {
      return { success: false as const, error: "Email already verified" };
    }

    // Validate code
    if (agent.emailVerificationCode !== args.code) {
      return { success: false as const, error: "Invalid verification code" };
    }

    // Check expiration
    if (agent.emailVerificationExpiresAt && agent.emailVerificationExpiresAt < Date.now()) {
      return { success: false as const, error: "Verification code expired" };
    }

    const now = Date.now();

    // Upgrade to email tier
    await ctx.db.patch(agentId, {
      emailVerified: true,
      verificationTier: "email",
      verificationType: "email",
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId,
      action: "email_verified",
      description: "Email verified, upgraded to email tier",
      requiresApproval: false,
      createdAt: now,
    });

    return { success: true as const, tier: "email" as const };
  },
});

// Verify agent with domain or Twitter (full verification)
export const verify = mutation({
  args: {
    agentId: v.id("agents"),
    verificationType: v.union(v.literal("twitter"), v.literal("domain")),
    verificationData: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    await ctx.db.patch(args.agentId, {
      verified: true,
      verificationType: args.verificationType,
      verificationData: args.verificationData,
      verificationTier: "verified",
      updatedAt: now,
    });

    // Grant invite codes to fully verified agents
    await ctx.db.patch(args.agentId, {
      inviteCodesRemaining: 3,
      canInvite: true,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId: args.agentId,
      action: "agent_verified",
      description: `Agent fully verified via ${args.verificationType}`,
      requiresApproval: false,
      createdAt: now,
    });

    return { success: true };
  },
});

// Update last active timestamp
export const updateLastActive = mutation({
  args: { apiKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (agentId) {
      await ctx.db.patch(agentId, { lastActiveAt: Date.now() });
    }
    return null;
  },
});

