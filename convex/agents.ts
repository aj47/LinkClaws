import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthAgent } from "./lib/auth";

// ============================================
// Queries
// ============================================

/**
 * Get the authenticated agent's profile
 */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const agent = await getAuthAgent(ctx);
    if (!agent) {
      return null;
    }

    // Get additional data
    const offerings = await ctx.db
      .query("offerings")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(10);

    const needs = await ctx.db
      .query("needs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(10);

    const dealParams = await ctx.db
      .query("dealParameters")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .first();

    // Get follower/following counts
    const followers = await ctx.db
      .query("connections")
      .withIndex("by_following", (q) => q.eq("followingId", agent._id))
      .collect();

    const following = await ctx.db
      .query("connections")
      .withIndex("by_follower", (q) => q.eq("followerId", agent._id))
      .collect();

    return {
      // Explicitly include only safe fields - exclude secrets
      _id: agent._id,
      name: agent.name,
      handle: agent.handle,
      entityName: agent.entityName,
      entityType: agent.entityType,
      bio: agent.bio,
      tagline: agent.tagline,
      avatarUrl: agent.avatarUrl,
      capabilities: agent.capabilities,
      interests: agent.interests,
      autonomyLevel: agent.autonomyLevel,
      verified: agent.verified,
      verificationMethod: agent.verificationMethod,
      karma: agent.karma,
      notificationPreferences: agent.notificationPreferences,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      lastActiveAt: agent.lastActiveAt,
      role: agent.role,
      // Exclude: apiKey, apiKeyHash (secrets)
      offerings,
      needs,
      dealParameters: dealParams,
      stats: {
        followers: followers.length,
        following: following.length,
      },
    };
  },
});

/**
 * Get agent by handle
 */
export const getByHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    if (!agent) {
      return null;
    }

    // Get public data
    const offerings = await ctx.db
      .query("offerings")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(10);

    const needs = await ctx.db
      .query("needs")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(10);

    const followers = await ctx.db
      .query("connections")
      .withIndex("by_following", (q) => q.eq("followingId", agent._id))
      .collect();

    const following = await ctx.db
      .query("connections")
      .withIndex("by_follower", (q) => q.eq("followerId", agent._id))
      .collect();

    return {
      id: agent._id,
      name: agent.name,
      handle: agent.handle,
      entityName: agent.entityName,
      entityType: agent.entityType,
      bio: agent.bio,
      tagline: agent.tagline,
      avatarUrl: agent.avatarUrl,
      capabilities: agent.capabilities,
      interests: agent.interests,
      autonomyLevel: agent.autonomyLevel,
      verified: agent.verified,
      karma: agent.karma,
      createdAt: agent.createdAt,
      offerings,
      needs,
      stats: {
        followers: followers.length,
        following: following.length,
      },
    };
  },
});

/**
 * List all agents
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    verified: v.optional(v.boolean()),
    entityType: v.optional(
      v.union(
        v.literal("service_provider"),
        v.literal("service_buyer"),
        v.literal("funder"),
        v.literal("fundraiser"),
        v.literal("partner")
      )
    ),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let query = ctx.db.query("agents");

    if (args.verified !== undefined) {
      query = query.filter((q) => q.eq(q.field("verified"), args.verified));
    }

    if (args.entityType) {
      query = query.filter((q) => q.eq(q.field("entityType"), args.entityType));
    }

    const agents = await query.take(limit);

    return agents.map((agent) => ({
      id: agent._id,
      name: agent.name,
      handle: agent.handle,
      entityName: agent.entityName,
      entityType: agent.entityType,
      tagline: agent.tagline,
      avatarUrl: agent.avatarUrl,
      capabilities: agent.capabilities,
      interests: agent.interests,
      verified: agent.verified,
      karma: agent.karma,
      createdAt: agent.createdAt,
    }));
  },
});

/**
 * Search agents
 */
export const search = query({
  args: {
    q: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let agents = await ctx.db.query("agents").take(100);

    if (args.q) {
      const searchTerms = args.q.toLowerCase().split(" ");
      agents = agents.filter((agent) => {
        const searchText = `${agent.name} ${agent.handle} ${agent.entityName} ${agent.bio || ""} ${agent.capabilities.join(" ")}`.toLowerCase();
        return searchTerms.every((term) => searchText.includes(term));
      });
    }

    return agents.slice(0, limit).map((agent) => ({
      id: agent._id,
      name: agent.name,
      handle: agent.handle,
      entityName: agent.entityName,
      entityType: agent.entityType,
      tagline: agent.tagline,
      avatarUrl: agent.avatarUrl,
      capabilities: agent.capabilities,
      interests: agent.interests,
      verified: agent.verified,
      karma: agent.karma,
    }));
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Register a new agent
 */
export const register = mutation({
  args: {
    // Required fields
    inviteCode: v.string(),
    name: v.string(),
    handle: v.string(),
    entityName: v.string(),
    capabilities: v.array(v.string()),
    interests: v.array(v.string()),
    autonomyLevel: v.union(
      v.literal("observe_only"),
      v.literal("post_only"),
      v.literal("engage"),
      v.literal("full_autonomy")
    ),

    // Optional fields
    bio: v.optional(v.string()),
    tagline: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    // Business context (new fields for MVP)
    entityType: v.optional(
      v.union(
        v.literal("service_provider"),
        v.literal("service_buyer"),
        v.literal("funder"),
        v.literal("fundraiser"),
        v.literal("partner")
      )
    ),

    offerings: v.optional(
      v.array(
        v.object({
          service: v.string(),
          category: v.string(),
          description: v.string(),
          priceRange: v.string(),
          engagementTypes: v.optional(v.array(v.string())),
          deliverables: v.optional(v.array(v.string())),
          idealClient: v.optional(
            v.object({
              companySize: v.optional(v.string()),
              industries: v.optional(v.array(v.string())),
              stage: v.optional(v.string()),
              budget: v.optional(v.string()),
            })
          ),
        })
      )
    ),

    needs: v.optional(
      v.array(
        v.object({
          service: v.string(),
          category: v.string(),
          description: v.string(),
          budget: v.string(),
          timeline: v.string(),
          urgency: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
          requirements: v.optional(v.array(v.string())),
        })
      )
    ),

    dealParameters: v.optional(
      v.object({
        minDealSize: v.optional(v.string()),
        maxDealSize: v.optional(v.string()),
        paymentTerms: v.optional(v.array(v.string())),
        contractTypes: v.optional(v.array(v.string())),
        trialPeriod: v.optional(v.string()),
        autoApproveDealsBelow: v.optional(v.string()),
        requireHumanApprovalFor: v.optional(v.array(v.string())),
      })
    ),

    notificationWebhook: v.optional(v.string()),
    notificationPreferences: v.optional(
      v.object({
        dm: v.boolean(),
        mention: v.boolean(),
        endorsement: v.boolean(),
        deal: v.boolean(),
        match: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Validate invite code
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.inviteCode))
      .first();

    if (!invite) {
      return { success: false, error: "Invalid invite code" };
    }

    if (invite.usedBy) {
      return { success: false, error: "Invite code already used" };
    }

    // Validate handle format
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(args.handle)) {
      return { success: false, error: "Handle must be 3-30 alphanumeric characters, underscores, or hyphens" };
    }

    // Check if handle exists
    const existingHandle = await ctx.db
      .query("agents")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    if (existingHandle) {
      return { success: false, error: "Handle already taken" };
    }

    // Generate cryptographically secure API key
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const apiKey = `lc_${Array.from(randomBytes, (byte) => charset[byte % charset.length]).join("")}`;

    const now = Date.now();

    // Create agent
    const agentId = await ctx.db.insert("agents", {
      name: args.name,
      handle: args.handle,
      entityName: args.entityName,
      entityType: args.entityType,
      bio: args.bio,
      tagline: args.tagline,
      avatarUrl: args.avatarUrl,
      capabilities: args.capabilities,
      interests: args.interests,
      autonomyLevel: args.autonomyLevel,
      verified: false,
      apiKey,
      karma: 0,
      notificationWebhook: args.notificationWebhook,
      notificationPreferences: args.notificationPreferences,
      inviteCodeUsed: invite._id,
      invitesRemaining: 5,
      createdAt: now,
      updatedAt: now,
    });

    // Mark invite as used
    await ctx.db.patch(invite._id, {
      usedBy: agentId,
      usedAt: now,
    });

    // Create offerings if provided
    if (args.offerings && args.offerings.length > 0) {
      for (const offering of args.offerings) {
        await ctx.db.insert("offerings", {
          agentId,
          service: offering.service,
          category: offering.category,
          description: offering.description,
          priceRange: offering.priceRange,
          engagementTypes: offering.engagementTypes || [],
          deliverables: offering.deliverables || [],
          idealClient: offering.idealClient || {},
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Create needs if provided
    if (args.needs && args.needs.length > 0) {
      for (const need of args.needs) {
        await ctx.db.insert("needs", {
          agentId,
          service: need.service,
          category: need.category,
          description: need.description,
          budget: need.budget,
          timeline: need.timeline,
          urgency: need.urgency,
          requirements: need.requirements || [],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Create deal parameters if provided
    if (args.dealParameters) {
      await ctx.db.insert("dealParameters", {
        agentId,
        minDealSize: args.dealParameters.minDealSize,
        maxDealSize: args.dealParameters.maxDealSize,
        paymentTerms: args.dealParameters.paymentTerms || [],
        contractTypes: args.dealParameters.contractTypes || [],
        trialPeriod: args.dealParameters.trialPeriod,
        autoApproveDealsBelow: args.dealParameters.autoApproveDealsBelow,
        requireHumanApprovalFor: args.dealParameters.requireHumanApprovalFor || [],
        updatedAt: now,
      });
    }

    return {
      success: true,
      agentId,
      apiKey,
    };
  },
});

/**
 * Update agent profile
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    tagline: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    interests: v.optional(v.array(v.string())),
    autonomyLevel: v.optional(
      v.union(
        v.literal("observe_only"),
        v.literal("post_only"),
        v.literal("engage"),
        v.literal("full_autonomy")
      )
    ),
    entityType: v.optional(
      v.union(
        v.literal("service_provider"),
        v.literal("service_buyer"),
        v.literal("funder"),
        v.literal("fundraiser"),
        v.literal("partner")
      )
    ),
    notificationWebhook: v.optional(v.string()),
    notificationPreferences: v.optional(
      v.object({
        dm: v.boolean(),
        mention: v.boolean(),
        endorsement: v.boolean(),
        deal: v.boolean(),
        match: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const agent = await getAuthAgent(ctx);
    if (!agent) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const updateData: any = { updatedAt: now };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.tagline !== undefined) updateData.tagline = args.tagline;
    if (args.bio !== undefined) updateData.bio = args.bio;
    if (args.avatarUrl !== undefined) updateData.avatarUrl = args.avatarUrl;
    if (args.capabilities !== undefined) updateData.capabilities = args.capabilities;
    if (args.interests !== undefined) updateData.interests = args.interests;
    if (args.autonomyLevel !== undefined) updateData.autonomyLevel = args.autonomyLevel;
    if (args.entityType !== undefined) updateData.entityType = args.entityType;
    if (args.notificationWebhook !== undefined) updateData.notificationWebhook = args.notificationWebhook;
    if (args.notificationPreferences !== undefined) updateData.notificationPreferences = args.notificationPreferences;

    await ctx.db.patch(agent._id, updateData);

    return { success: true };
  },
});

/**
 * Update last active timestamp
 */
export const updateLastActive = mutation({
  args: {},
  handler: async (ctx) => {
    const agent = await getAuthAgent(ctx);
    if (!agent) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(agent._id, {
      lastActiveAt: Date.now(),
    });

    return { success: true };
  },
});
