import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyHumanSession } from "./humanUsers";

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
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { success: false as const, error: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false as const, error: "User not found" };
    }

    if (user.organizationId) {
      return { success: false as const, error: "You already belong to an organization" };
    }

    // Create organization
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      description: args.description,
      website: args.website,
      verified: false,
      createdAt: Date.now(),
    });

    // Link user to organization
    await ctx.db.patch(userId, { organizationId });

    return { success: true as const, organizationId };
  },
});

// List organizations
export const list = query({
  args: { sessionToken: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      website: v.optional(v.string()),
      verified: v.boolean(),
      createdAt: v.number(),
      agentCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) return [];

    const orgs = await ctx.db.query("organizations").order("desc").take(100);

    const result = await Promise.all(
      orgs.map(async (org) => {
        const agents = await ctx.db
          .query("agents")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
          .collect();
        return {
          _id: org._id,
          name: org.name,
          description: org.description,
          website: org.website,
          verified: org.verified,
          createdAt: org.createdAt,
          agentCount: agents.length,
        };
      })
    );

    return result;
  },
});

// Get organization by ID with agents
export const getById = query({
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
      createdAt: v.number(),
      agents: v.array(
        v.object({
          _id: v.id("agents"),
          name: v.string(),
          handle: v.string(),
          verified: v.boolean(),
          karma: v.number(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) return null;

    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
      .collect();

    return {
      _id: org._id,
      name: org.name,
      description: org.description,
      website: org.website,
      verified: org.verified,
      createdAt: org.createdAt,
      agents: agents.map((a) => ({
        _id: a._id,
        name: a.name,
        handle: a.handle,
        verified: a.verified,
        karma: a.karma,
      })),
    };
  },
});

// Update organization
export const update = mutation({
  args: {
    sessionToken: v.string(),
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { success: false as const, error: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user || user.organizationId !== args.organizationId) {
      return { success: false as const, error: "Not authorized" };
    }

    const updates: { name?: string; description?: string; website?: string } = {};
    if (args.name) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.website !== undefined) updates.website = args.website;

    await ctx.db.patch(args.organizationId, updates);
    return { success: true as const };
  },
});

// Add agent to organization
export const addAgent = mutation({
  args: {
    sessionToken: v.string(),
    agentId: v.id("agents"),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { success: false as const, error: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.organizationId) {
      return { success: false as const, error: "You must belong to an organization" };
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return { success: false as const, error: "Agent not found" };
    }

    if (agent.organizationId) {
      return { success: false as const, error: "Agent already belongs to an organization" };
    }

    await ctx.db.patch(args.agentId, { organizationId: user.organizationId });
    return { success: true as const };
  },
});

// Remove agent from organization
export const removeAgent = mutation({
  args: {
    sessionToken: v.string(),
    agentId: v.id("agents"),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { success: false as const, error: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.organizationId) {
      return { success: false as const, error: "You must belong to an organization" };
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return { success: false as const, error: "Agent not found" };
    }

    if (agent.organizationId !== user.organizationId) {
      return { success: false as const, error: "Agent does not belong to your organization" };
    }

    await ctx.db.patch(args.agentId, { organizationId: undefined });
    return { success: true as const };
  },
});

