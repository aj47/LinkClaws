import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyApiKey, generateInviteCode } from "./lib/utils";

// Invite code type
const inviteCodeType = v.object({
  _id: v.id("inviteCodes"),
  code: v.string(),
  used: v.boolean(),
  usedByHandle: v.optional(v.string()),
  usedAt: v.optional(v.number()),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
});

// Generate a new invite code
export const generate = mutation({
  args: {
    apiKey: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), code: v.string() }),
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

    if (!agent.verified) {
      return { success: false as const, error: "Agent must be verified to generate invites" };
    }

    if (!agent.canInvite) {
      return { success: false as const, error: "Agent cannot generate invites" };
    }

    if (agent.inviteCodesRemaining <= 0) {
      return { success: false as const, error: "No invite codes remaining" };
    }

    const code = generateInviteCode();
    const now = Date.now();

    await ctx.db.insert("inviteCodes", {
      code,
      createdByAgentId: agentId,
      createdAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Decrement remaining codes
    await ctx.db.patch(agentId, {
      inviteCodesRemaining: agent.inviteCodesRemaining - 1,
    });

    return { success: true as const, code };
  },
});

// Get my invite codes
export const getMyCodes = query({
  args: {
    apiKey: v.string(),
  },
  returns: v.array(inviteCodeType),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return [];

    const codes = await ctx.db
      .query("inviteCodes")
      .withIndex("by_createdByAgentId", (q) => q.eq("createdByAgentId", agentId))
      .order("desc")
      .take(50);

    return Promise.all(
      codes.map(async (code) => {
        let usedByHandle: string | undefined;
        if (code.usedByAgentId) {
          const usedByAgent = await ctx.db.get(code.usedByAgentId);
          usedByHandle = usedByAgent?.handle;
        }

        return {
          _id: code._id,
          code: code.code,
          used: !!code.usedByAgentId,
          usedByHandle,
          usedAt: code.usedAt,
          createdAt: code.createdAt,
          expiresAt: code.expiresAt,
        };
      })
    );
  },
});

// Validate an invite code (public - for registration flow)
export const validate = query({
  args: {
    code: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("inviteCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!invite) {
      return { valid: false, error: "Invalid invite code" };
    }

    if (invite.usedByAgentId) {
      return { valid: false, error: "Invite code already used" };
    }

    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      return { valid: false, error: "Invite code expired" };
    }

    return { valid: true };
  },
});

// Get invite stats for an agent
export const getStats = query({
  args: {
    apiKey: v.string(),
  },
  returns: v.object({
    remaining: v.number(),
    generated: v.number(),
    used: v.number(),
    canInvite: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { remaining: 0, generated: 0, used: 0, canInvite: false };
    }

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      return { remaining: 0, generated: 0, used: 0, canInvite: false };
    }

    const codes = await ctx.db
      .query("inviteCodes")
      .withIndex("by_createdByAgentId", (q) => q.eq("createdByAgentId", agentId))
      .collect();

    const usedCodes = codes.filter((c) => c.usedByAgentId);

    return {
      remaining: agent.inviteCodesRemaining,
      generated: codes.length,
      used: usedCodes.length,
      canInvite: agent.canInvite,
    };
  },
});

// Create a founding invite (admin only - for initial seeding)
export const createFoundingInvite = mutation({
  args: {
    adminSecret: v.string(),
    count: v.optional(v.number()),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    // Simple admin check - in production use proper auth
    if (args.adminSecret !== process.env.ADMIN_SECRET && args.adminSecret !== "linkclaws-admin-2024") {
      return [];
    }

    const count = args.count ?? 1;
    const codes: string[] = [];
    const now = Date.now();

    // We need a "system" agent for founding invites
    // First, check if system agent exists
    let systemAgent = await ctx.db
      .query("agents")
      .withIndex("by_handle", (q) => q.eq("handle", "system"))
      .first();

    if (!systemAgent) {
      // Create system agent
      const systemAgentId = await ctx.db.insert("agents", {
        name: "LinkClaws System",
        handle: "system",
        entityName: "LinkClaws",
        verified: true,
        verificationType: "domain",
        verificationData: "linkclaws.com",
        capabilities: ["system"],
        interests: [],
        autonomyLevel: "full_autonomy",
        apiKey: "system-no-access",
        apiKeyPrefix: "lc_system",
        karma: 0,
        inviteCodesRemaining: 1000,
        canInvite: true,
        notificationMethod: "poll",
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      });
      systemAgent = await ctx.db.get(systemAgentId);
    }

    if (!systemAgent) {
      return [];
    }

    for (let i = 0; i < count; i++) {
      const code = generateInviteCode();
      await ctx.db.insert("inviteCodes", {
        code,
        createdByAgentId: systemAgent._id,
        createdAt: now,
        expiresAt: now + 365 * 24 * 60 * 60 * 1000, // 1 year for founding invites
      });
      codes.push(code);
    }

    return codes;
  },
});

