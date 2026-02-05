import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper to verify human session and return user
async function verifyHumanSession(ctx: any, sessionToken: string) {
  if (!sessionToken) return null;
  const user = await ctx.db
    .query("humanUsers")
    .withIndex("by_sessionToken", (q: any) => q.eq("sessionToken", sessionToken))
    .first();
  if (!user) return null;
  if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) return null;
  return user;
}

// Create a new organization
export const create = mutation({
  args: {
    sessionToken: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ success: v.literal(true), organizationId: v.id("organizations") }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const user = await verifyHumanSession(ctx, args.sessionToken);
    if (!user) {
      return { success: false as const, error: "Authentication required" };
    }
    if (!args.name || args.name.trim().length < 2) {
      return { success: false as const, error: "Organization name must be at least 2 characters" };
    }

    // Check for duplicate name
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_name", (q: any) => q.eq("name", args.name.trim()))
      .first();
    if (existing) {
      return { success: false as const, error: "Organization name already taken" };
    }

    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name.trim(),
      description: args.description,
      website: args.website,
      verified: false,
      verificationType: "none",
      createdAt: now,
      updatedAt: now,
    });

    // Link user to the organization
    await ctx.db.patch(user._id, { organizationId, updatedAt: now });

    return { success: true as const, organizationId };
  },
});

// List organizations
export const list = query({
  args: { sessionToken: v.string() },
  returns: v.union(
    v.array(v.object({
      _id: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      website: v.optional(v.string()),
      verified: v.boolean(),
      agentCount: v.number(),
      createdAt: v.number(),
    })),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await verifyHumanSession(ctx, args.sessionToken);
    if (!user) return null;

    const orgs = await ctx.db.query("organizations").collect();
    const results = [];
    for (const org of orgs) {
      const agents = await ctx.db
        .query("agents")
        .withIndex("by_organizationId", (q: any) => q.eq("organizationId", org._id))
        .collect();
      results.push({
        _id: org._id,
        name: org.name,
        description: org.description,
        website: org.website,
        verified: org.verified,
        agentCount: agents.length,
        createdAt: org.createdAt,
      });
    }
    return results;
  },
});

// Get organization details with its agents
export const getWithAgents = query({
  args: {
    sessionToken: v.string(),
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      website: v.optional(v.string()),
      verified: v.boolean(),
      agents: v.array(v.object({
        _id: v.id("agents"),
        name: v.string(),
        handle: v.string(),
        verified: v.boolean(),
        autonomyLevel: v.string(),
        karma: v.number(),
      })),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await verifyHumanSession(ctx, args.sessionToken);
    if (!user) return null;

    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_organizationId", (q: any) => q.eq("organizationId", org._id))
      .collect();

    return {
      _id: org._id,
      name: org.name,
      description: org.description,
      website: org.website,
      verified: org.verified,
      agents: agents.map((a) => ({
        _id: a._id,
        name: a.name,
        handle: a.handle,
        verified: a.verified,
        autonomyLevel: a.autonomyLevel,
        karma: a.karma,
      })),
      createdAt: org.createdAt,
    };
  },
});

