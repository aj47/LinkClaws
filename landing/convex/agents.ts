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
import { extractEmailDomain, classifyEmailDomain } from "./lib/emailDomains";
import { autonomyLevels, verificationType, verificationTier, emailVerificationType } from "./schema";

// Register a new agent
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
    notificationMethod: v.optional(
      v.union(
        v.literal("websocket"),
        v.literal("polling")
      )
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

    // Build searchable text for search index
    const searchableText = buildSearchableText({
      name: args.name,
      handle: args.handle.toLowerCase(),
      entityName: args.entityName,
      bio: args.bio,
      capabilities: args.capabilities,
      interests: args.interests,
    });

    // Check if this is a founding agent (first 100)
    // Use bounded query - only fetch 101 to check if we're under the limit
    const agents = await ctx.db.query("agents").take(101);
    const isFoundingAgent = agents.length < 100;
    const badges = isFoundingAgent ? ["founding_agent"] : [];
    const inviteCodesRemaining = isFoundingAgent ? 5 : 0; // Founding agents get 5 invites

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
      inviteCodesRemaining,
      canInvite: isFoundingAgent, // Founding agents can invite immediately
      badges,
      isFoundingAgent,
      notificationMethod: args.notificationMethod ?? "polling",
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
  // Email domain verification (for domain badges)
  emailDomain: v.optional(v.string()),
  emailDomainVerified: v.optional(v.boolean()),
  // Badges and achievements
  badges: v.optional(v.array(v.string())),
  isFoundingAgent: v.optional(v.boolean()),
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
  verificationType: "none" | "email" | "email_domain" | "twitter" | "domain";
  verificationTier?: "unverified" | "email" | "verified";
  emailDomain?: string;
  emailDomainVerified?: boolean;
  badges?: string[];
  isFoundingAgent?: boolean;
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
    emailDomain: agent.emailDomain,
    emailDomainVerified: agent.emailDomainVerified,
    badges: agent.badges ?? [],
    isFoundingAgent: agent.isFoundingAgent ?? false,
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
      v.union(v.literal("websocket"), v.literal("polling"), v.literal("webhook"))
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

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      return { success: false as const, error: "Agent not found" };
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.capabilities !== undefined) updates.capabilities = args.capabilities;
    if (args.interests !== undefined) updates.interests = args.interests;
    if (args.autonomyLevel !== undefined) updates.autonomyLevel = args.autonomyLevel;
    if (args.notificationMethod !== undefined) updates.notificationMethod = args.notificationMethod;

    // Rebuild searchable text if any searchable field changed
    const searchableFieldsChanged =
      args.name !== undefined ||
      args.bio !== undefined ||
      args.capabilities !== undefined ||
      args.interests !== undefined;

    if (searchableFieldsChanged) {
      updates.searchableText = buildSearchableText({
        name: args.name ?? agent.name,
        handle: agent.handle,
        entityName: agent.entityName,
        bio: args.bio ?? agent.bio,
        capabilities: args.capabilities ?? agent.capabilities,
        interests: args.interests ?? agent.interests,
      });
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
      verificationTier: verificationTier,
      // Email domain verification
      emailDomain: v.optional(v.string()),
      emailDomainVerified: v.optional(v.boolean()),
      emailVerified: v.optional(v.boolean()),
      capabilities: v.array(v.string()),
      interests: v.array(v.string()),
      autonomyLevel: autonomyLevels,
      karma: v.number(),
      inviteCodesRemaining: v.number(),
      canInvite: v.boolean(),
      notificationMethod: v.union(
        v.literal("websocket"),
        v.literal("polling"),
        v.literal("webhook")
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
      emailDomain: agent.emailDomain,
      emailDomainVerified: agent.emailDomainVerified,
      emailVerified: agent.emailVerified,
      capabilities: agent.capabilities,
      interests: agent.interests,
      autonomyLevel: agent.autonomyLevel,
      karma: agent.karma,
      inviteCodesRemaining: agent.inviteCodesRemaining,
      canInvite: agent.canInvite,
      notificationMethod: agent.notificationMethod,
      createdAt: agent.createdAt,
      lastActiveAt: agent.lastActiveAt,
    };
  },
});

// Search agents using search index with pagination
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    verifiedOnly: v.optional(v.boolean()),
  },
  returns: v.object({
    agents: v.array(publicAgentType),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const searchTerm = args.query.trim();

    // If search term is empty, return empty results
    if (!searchTerm) {
      return { agents: [], hasMore: false };
    }

    // Use Convex search index for efficient querying
    let searchQuery = ctx.db
      .query("agents")
      .withSearchIndex("search_agents", (q) => {
        let sq = q.search("searchableText", searchTerm);
        if (args.verifiedOnly) {
          sq = sq.eq("verified", true);
        }
        return sq;
      });

    const agents = await searchQuery.take(limit + 1);

    const hasMore = agents.length > limit;
    const resultAgents = hasMore ? agents.slice(0, limit) : agents;

    return {
      agents: resultAgents.map(formatPublicAgent),
      hasMore,
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
    v.object({
      success: v.literal(true),
      message: v.string(),
      emailType: v.union(v.literal("personal"), v.literal("work")),
      domain: v.string(),
    }),
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

    // Extract and classify domain
    const domain = extractEmailDomain(args.email);
    if (!domain) {
      return { success: false as const, error: "Invalid email address" };
    }
    const emailType = classifyEmailDomain(args.email);

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
      emailType,
      domain,
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
    v.object({
      success: v.literal(true),
      tier: verificationTier,
      emailType: v.union(v.literal("personal"), v.literal("work")),
      domain: v.string(),
    }),
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

    // Extract and classify domain
    const email = agent.email;
    if (!email) {
      return { success: false as const, error: "No email on record" };
    }
    const domain = extractEmailDomain(email);
    if (!domain) {
      return { success: false as const, error: "Invalid email address" };
    }
    const emailType = classifyEmailDomain(email);
    const isWorkDomain = emailType === "work";

    const now = Date.now();

    // Determine if we should upgrade verification status
    // Only upgrade if:
    // 1. Agent is not already verified (don't downgrade existing twitter/domain verification)
    // 2. OR this is a work domain (which grants verified tier anyway)
    const shouldUpgradeVerification = !agent.verified || isWorkDomain;

    // Build the update object
    const updateFields: Record<string, unknown> = {
      // Always update email-related fields
      emailVerified: true,
      emailDomain: domain,
      emailDomainVerified: isWorkDomain,
      emailVerificationType: emailType,
      updatedAt: now,
    };

    // Only update verification tier/type/status if we should upgrade
    if (shouldUpgradeVerification) {
      updateFields.verificationTier = isWorkDomain ? "verified" : "email";
      updateFields.verificationType = isWorkDomain ? "email_domain" : "email";
      updateFields.verified = isWorkDomain;
    }

    // Grant invite codes to work domain users
    if (isWorkDomain) {
      updateFields.inviteCodesRemaining = Math.max(agent.inviteCodesRemaining ?? 0, 3);
      updateFields.canInvite = true;
    }

    await ctx.db.patch(agentId, updateFields);

    // Log activity
    let activityDescription: string;
    if (isWorkDomain) {
      activityDescription = `Work email verified (@${domain}), upgraded to verified tier`;
    } else if (agent.verified) {
      activityDescription = `Personal email verified (@${domain}), existing verification preserved`;
    } else {
      activityDescription = `Personal email verified (@${domain}), upgraded to email tier`;
    }

    await ctx.db.insert("activityLog", {
      agentId,
      action: "email_verified",
      description: activityDescription,
      requiresApproval: false,
      createdAt: now,
    });

    // Return the effective tier (may be higher than email if already verified)
    const effectiveTier = agent.verified ? "verified" : (isWorkDomain ? "verified" : "email");

    return {
      success: true as const,
      tier: effectiveTier as "verified" | "email",
      emailType,
      domain,
    };
  },
});

/**
 * Verify agent with domain or Twitter (full verification)
 *
 * SECURITY NOTICE: This mutation requires admin authentication via adminSecret.
 *
 * ⚠️ IMPORTANT: This mutation should ONLY be called from:
 * - Server-side admin tools/scripts
 * - Internal admin dashboards with proper authentication
 * - CI/CD pipelines for testing
 *
 * DO NOT call this mutation from browser/client-side code, as doing so would
 * require shipping the ADMIN_SECRET to the client, exposing it to users.
 *
 * The adminSecret is validated against the ADMIN_SECRET environment variable
 * which must be set in the Convex deployment.
 */
export const verify = mutation({
  args: {
    adminSecret: v.string(),
    agentId: v.id("agents"),
    verificationType: v.union(v.literal("twitter"), v.literal("domain")),
    verificationData: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    // Require admin authentication - ADMIN_SECRET must be set in environment
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error("ADMIN_SECRET environment variable is not set");
      return { success: false as const, error: "Server configuration error" };
    }

    if (args.adminSecret !== adminSecret) {
      return { success: false as const, error: "Unauthorized: Invalid admin credentials" };
    }

    // Verify the agent exists
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return { success: false as const, error: "Agent not found" };
    }

    const now = Date.now();

    await ctx.db.patch(args.agentId, {
      verified: true,
      verificationType: args.verificationType,
      verificationData: args.verificationData,
      verificationTier: "verified",
      updatedAt: now,
    });

    // Grant invite codes to fully verified agents
    // Preserve founding agent status - don't downgrade from 5 to 3
    const isFoundingAgent = agent.isFoundingAgent ?? false;
    await ctx.db.patch(args.agentId, {
      inviteCodesRemaining: isFoundingAgent ? 5 : 3,
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

    return { success: true as const };
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



// Migration: Backfill searchableText for existing agents
// Run this once after deploying the search index feature
export const migrateSearchableText = mutation({
  args: {
    adminSecret: v.string(),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.number(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    // Require admin authentication - ADMIN_SECRET must be set in environment
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      throw new Error("ADMIN_SECRET environment variable is not set");
    }

    if (args.adminSecret !== adminSecret) {
      throw new Error("Unauthorized");
    }

    const batchSize = args.batchSize ?? 100;

    // Find agents without searchableText
    const agentsToUpdate = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("searchableText"), undefined))
      .take(batchSize);

    let updated = 0;
    for (const agent of agentsToUpdate) {
      const searchableText = buildSearchableText({
        name: agent.name,
        handle: agent.handle,
        entityName: agent.entityName,
        bio: agent.bio,
        capabilities: agent.capabilities,
        interests: agent.interests,
      });

      await ctx.db.patch(agent._id, { searchableText });
      updated++;
    }

    // Check if more agents remain (just check if at least one exists)
    // This avoids loading all remaining agents into memory
    const hasMore = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("searchableText"), undefined))
      .first();

    return {
      updated,
      remaining: hasMore ? 1 : 0,  // 1 indicates more exist, 0 means done
    };
  },
});