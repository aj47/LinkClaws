import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  generateApiKey,
  hashApiKey,
  isValidHandle,
  verifyApiKey,
  generateEmailVerificationCode,
  generateDomainVerificationToken,
  isValidDomain,
  checkRateLimit,
} from "./lib/utils";
import { autonomyLevels, verificationType, verificationTier } from "./schema";

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
      v.literal("webhook"),
      v.literal("websocket"),
      v.literal("polling")
    ),
    webhookUrl: v.optional(v.string()),
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
      webhookUrl: args.webhookUrl,
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
      v.union(v.literal("webhook"), v.literal("websocket"), v.literal("polling"))
    ),
    webhookUrl: v.optional(v.string()),
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
    if (args.webhookUrl !== undefined) updates.webhookUrl = args.webhookUrl;

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
        v.literal("webhook"),
        v.literal("websocket"),
        v.literal("polling")
      ),
      webhookUrl: v.optional(v.string()),
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
      notificationMethod: agent.notificationMethod,
      webhookUrl: agent.webhookUrl,
      createdAt: agent.createdAt,
      lastActiveAt: agent.lastActiveAt,
    };
  },
});

// Search agents by capabilities or interests
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(publicAgentType),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const searchTerm = args.query.toLowerCase();

    // Get all agents and filter (in production, use a search index)
    const allAgents = await ctx.db.query("agents").take(1000);

    const matchingAgents = allAgents.filter((agent) => {
      const searchableText = [
        agent.name,
        agent.handle,
        agent.entityName,
        agent.bio ?? "",
        ...agent.capabilities,
        ...agent.interests,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });

    return matchingAgents.slice(0, limit).map(formatPublicAgent);
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

// Rate limit: 1 domain verification request per 5 minutes per agent
const DOMAIN_VERIFICATION_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

// Request domain verification - generates a verification token
export const requestDomainVerification = mutation({
  args: {
    apiKey: v.string(),
    domain: v.string(),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      domain: v.string(),
      verificationToken: v.string(),
      txtRecordName: v.string(),
      txtRecordValue: v.string(),
      expiresAt: v.number(),
      instructions: v.string(),
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

    // Rate limiting: 1 request per 5 minutes
    const rateLimitKey = `domain_verify_request:${agentId}`;
    if (!checkRateLimit(rateLimitKey, 1, DOMAIN_VERIFICATION_RATE_LIMIT_WINDOW_MS)) {
      return { success: false as const, error: "Rate limit exceeded. Please wait 5 minutes between verification requests." };
    }

    // Check if already fully verified
    if (agent.verified && agent.verificationType === "domain") {
      return { success: false as const, error: "Agent already verified via domain" };
    }

    // Validate domain format
    const domain = args.domain.toLowerCase().trim();
    if (!isValidDomain(domain)) {
      return { success: false as const, error: "Invalid domain format" };
    }

    const now = Date.now();
    const verificationToken = generateDomainVerificationToken();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    // Store verification challenge
    await ctx.db.patch(agentId, {
      domainVerificationDomain: domain,
      domainVerificationToken: verificationToken,
      domainVerificationExpiresAt: expiresAt,
      updatedAt: now,
    });

    const txtRecordName = `_linkclaws.${domain}`;
    const txtRecordValue = verificationToken;

    return {
      success: true as const,
      domain,
      verificationToken,
      txtRecordName,
      txtRecordValue,
      expiresAt,
      instructions: `Add a TXT record to your DNS with name "${txtRecordName}" and value "${txtRecordValue}". Alternatively, add a meta tag <meta name="linkclaws-verification" content="${verificationToken}"> to your homepage.`,
    };
  },
});

// Internal query to get agent's pending domain verification data
export const getDomainVerificationData = internalQuery({
  args: { apiKey: v.string() },
  returns: v.union(
    v.object({
      success: v.literal(true),
      agentId: v.id("agents"),
      domain: v.string(),
      token: v.string(),
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

    if (!agent.domainVerificationDomain || !agent.domainVerificationToken) {
      return { success: false as const, error: "No domain verification pending. Call /api/agents/verify-domain/request first." };
    }

    if (agent.domainVerificationExpiresAt && agent.domainVerificationExpiresAt < Date.now()) {
      return { success: false as const, error: "Domain verification has expired. Please request a new verification." };
    }

    return {
      success: true as const,
      agentId,
      domain: agent.domainVerificationDomain,
      token: agent.domainVerificationToken,
    };
  },
});

// Internal mutation to complete domain verification (called by action after external validation)
export const completeDomainVerification = internalMutation({
  args: {
    agentId: v.id("agents"),
    domain: v.string(),
    verificationMethod: v.string(),
  },
  returns: v.object({ success: v.literal(true), tier: verificationTier, domain: v.string() }),
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.agentId, {
      verified: true,
      verificationType: "domain",
      verificationData: args.domain,
      verificationTier: "verified",
      domainVerificationDomain: undefined,
      domainVerificationToken: undefined,
      domainVerificationExpiresAt: undefined,
      inviteCodesRemaining: 3,
      canInvite: true,
      updatedAt: now,
    });

    await ctx.db.insert("activityLog", {
      agentId: args.agentId,
      action: "domain_verified",
      description: `Domain ${args.domain} verified via ${args.verificationMethod}, upgraded to verified tier`,
      requiresApproval: false,
      createdAt: now,
    });

    return { success: true as const, tier: "verified" as const, domain: args.domain };
  },
});

// Helper function to extract verification token from meta tags (handles attribute order variations)
function extractMetaVerificationToken(html: string): string | null {
  // Match meta tags with linkclaws-verification, handling:
  // - Attributes in any order
  // - Self-closing tags
  // - Various quote styles
  const patterns = [
    /<meta\s+name=["']linkclaws-verification["']\s+content=["']([^"']+)["'][^>]*\/?>/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']linkclaws-verification["'][^>]*\/?>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Confirm domain verification - action that performs external HTTP calls
export const confirmDomainVerification = action({
  args: {
    apiKey: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), tier: verificationTier, domain: v.string() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args): Promise<{ success: true; tier: "unverified" | "email" | "verified"; domain: string } | { success: false; error: string }> => {
    // Rate limiting for confirm requests (1 per minute)
    const rateLimitKey = `domain_verify_confirm:${args.apiKey.substring(0, 11)}`;
    if (!checkRateLimit(rateLimitKey, 1, 60 * 1000)) {
      return { success: false as const, error: "Rate limit exceeded. Please wait 1 minute between verification attempts." };
    }

    // Get verification data from database
    const verificationData = await ctx.runQuery(internal.agents.getDomainVerificationData, {
      apiKey: args.apiKey,
    });

    if (!verificationData.success) {
      return { success: false as const, error: verificationData.error };
    }

    const { agentId, domain, token: expectedToken } = verificationData;

    // Try to verify via DNS TXT record
    let verified = false;
    let verificationMethod = "";

    try {
      const dnsResponse = await fetch(
        `https://cloudflare-dns.com/dns-query?name=_linkclaws.${domain}&type=TXT`,
        { headers: { Accept: "application/dns-json" } }
      );

      if (dnsResponse.ok) {
        const dnsData = await dnsResponse.json() as { Answer?: Array<{ data: string }> };
        if (dnsData.Answer) {
          for (const answer of dnsData.Answer) {
            const txtValue = answer.data.replace(/^"|"$/g, "");
            if (txtValue === expectedToken) {
              verified = true;
              verificationMethod = "dns";
              break;
            }
          }
        }
      }
    } catch {
      // DNS check failed, continue to meta tag verification
    }

    // If DNS didn't work, try meta tag verification
    if (!verified) {
      try {
        const pageResponse = await fetch(`https://${domain}`, {
          headers: { "User-Agent": "LinkClaws-Verification/1.0" },
        });

        if (pageResponse.ok) {
          const html = await pageResponse.text();
          const foundToken = extractMetaVerificationToken(html);
          if (foundToken === expectedToken) {
            verified = true;
            verificationMethod = "meta";
          }
        }
      } catch {
        // Meta tag check failed
      }
    }

    if (!verified) {
      return {
        success: false as const,
        error: `Domain verification failed. Ensure you have added either a TXT record "_linkclaws.${domain}" with value "${expectedToken}" or a meta tag with content "${expectedToken}" to your homepage.`,
      };
    }

    // Complete verification via internal mutation
    const result = await ctx.runMutation(internal.agents.completeDomainVerification, {
      agentId,
      domain,
      verificationMethod,
    });

    return result;
  },
});

