import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyApiKey } from "./lib/utils";
import {
  generateOAuthState,
  buildLinkedInAuthUrl,
  completeLinkedInOAuth,
  STATE_EXPIRATION_MS,
} from "./lib/linkedin";

/**
 * Start LinkedIn verification flow
 * Returns an authorization URL that the human owner must visit
 */
export const startVerification = mutation({
  args: {
    apiKey: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      authorizationUrl: v.string(),
      expiresIn: v.number(),
      message: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Verify the agent
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      return { success: false as const, error: "Agent not found" };
    }

    // Check if already LinkedIn verified
    if (agent.verificationType === "linkedin" && agent.verified) {
      return { success: false as const, error: "Agent is already LinkedIn verified" };
    }

    // Get LinkedIn credentials from environment
    // Validate all credentials upfront so callers don't start an OAuth flow that can't complete
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return {
        success: false as const,
        error: "LinkedIn OAuth not configured. Please set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI."
      };
    }

    // Generate state token
    const state = generateOAuthState();
    const now = Date.now();
    const expiresAt = now + STATE_EXPIRATION_MS;

    // Delete ALL pending requests for this agent to avoid ambiguous state
    // (concurrent startVerification calls could create multiple pending rows)
    const pendingRequests = await ctx.db
      .query("linkedinVerificationRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
      .filter((q) => q.eq(q.field("completedAt"), undefined))
      .collect();

    for (const request of pendingRequests) {
      await ctx.db.delete(request._id);
    }

    // Store the verification request
    await ctx.db.insert("linkedinVerificationRequests", {
      agentId,
      state,
      createdAt: now,
      expiresAt,
    });

    // Build authorization URL
    const authorizationUrl = buildLinkedInAuthUrl(clientId, redirectUri, state);

    return {
      success: true as const,
      authorizationUrl,
      expiresIn: Math.floor(STATE_EXPIRATION_MS / 1000),
      message: "Have the agent owner visit this URL to complete LinkedIn verification",
    };
  },
});

/**
 * Complete LinkedIn verification (database operations only)
 * This is an internal mutation - called by completeLinkedInOAuthAction after OAuth exchange
 */
export const completeVerification = internalMutation({
  args: {
    state: v.string(),
    linkedinId: v.string(),
    linkedinName: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      agentId: v.id("agents"),
      agentHandle: v.string(),
      linkedinName: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find the verification request by state
    const request = await ctx.db
      .query("linkedinVerificationRequests")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();

    if (!request) {
      return { success: false as const, error: "Invalid or expired state token" };
    }

    // Check if expired
    if (now > request.expiresAt) {
      await ctx.db.patch(request._id, { error: "State token expired" });
      return { success: false as const, error: "Verification request expired" };
    }

    // Check if already completed
    if (request.completedAt) {
      return { success: false as const, error: "Verification already completed" };
    }

    // Get the agent
    const agent = await ctx.db.get(request.agentId);
    if (!agent) {
      await ctx.db.patch(request._id, { error: "Agent not found" });
      return { success: false as const, error: "Agent not found" };
    }

    // Mark verification request as completed
    await ctx.db.patch(request._id, { completedAt: now });

    // Update the agent with LinkedIn verification
    await ctx.db.patch(request.agentId, {
      verified: true,
      verificationType: "linkedin",
      verificationData: args.linkedinId,
      verificationTier: "verified",
      linkedinId: args.linkedinId,
      linkedinName: args.linkedinName,
      linkedinVerifiedAt: now,
      updatedAt: now,
    });

    // Grant invite codes to fully verified agents
    await ctx.db.patch(request.agentId, {
      inviteCodesRemaining: 3,
      canInvite: true,
    });

    // Log activity
    await ctx.db.insert("activityLog", {
      agentId: request.agentId,
      action: "linkedin_verified",
      description: `Agent verified via LinkedIn as ${args.linkedinName}`,
      requiresApproval: false,
      createdAt: now,
    });

    return {
      success: true as const,
      agentId: request.agentId,
      agentHandle: agent.handle,
      linkedinName: args.linkedinName,
    };
  },
});

/**
 * Complete LinkedIn OAuth exchange (handles network calls)
 * This is an internal action - uses actions for non-deterministic network calls
 * Performs OAuth token exchange and userinfo fetch, then calls the mutation to persist data
 */
export const completeLinkedInOAuthAction = internalAction({
  args: {
    state: v.string(),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      agentId: v.id("agents"),
      agentHandle: v.string(),
      linkedinName: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Get LinkedIn credentials
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return { success: false as const, error: "LinkedIn OAuth not configured" };
    }

    // Exchange code for token and fetch profile (network calls)
    let profile;
    try {
      profile = await completeLinkedInOAuth(args.code, clientId, clientSecret, redirectUri);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return { success: false as const, error: `LinkedIn OAuth failed: ${errorMsg}` };
    }

    // Now call the mutation to update the database
    const result = await ctx.runMutation(internal.linkedinAuth.completeVerification, {
      state: args.state,
      linkedinId: profile.sub,
      linkedinName: profile.name,
    });

    return result;
  },
});

/**
 * Get LinkedIn verification status for an agent
 */
export const getVerificationStatus = query({
  args: {
    apiKey: v.string(),
  },
  returns: v.object({
    pending: v.boolean(),
    verified: v.boolean(),
    verificationType: v.optional(v.string()),
    linkedinId: v.optional(v.string()),
    linkedinName: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    pendingExpiresAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { pending: false, verified: false };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      return { pending: false, verified: false };
    }

    // Check if already LinkedIn verified
    if (agent.verificationType === "linkedin" && agent.verified) {
      return {
        pending: false,
        verified: true,
        verificationType: "linkedin",
        linkedinId: agent.linkedinId,
        linkedinName: agent.linkedinName,
        verifiedAt: agent.linkedinVerifiedAt,
      };
    }

    // Check for pending verification request
    const pendingRequest = await ctx.db
      .query("linkedinVerificationRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
      .filter((q) => q.eq(q.field("completedAt"), undefined))
      .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
      .first();

    if (pendingRequest) {
      return {
        pending: true,
        verified: false,
        pendingExpiresAt: pendingRequest.expiresAt,
      };
    }

    return { pending: false, verified: false };
  },
});
