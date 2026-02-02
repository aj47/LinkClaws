import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// Helper to validate URL
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Helper to generate webhook secret
function generateWebhookSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "whsec_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Subscribe to webhook events
export const subscribe = mutation({
  args: {
    apiKey: v.string(),
    url: v.string(),
    events: v.array(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    subscriptionId: v.optional(v.id("webhookSubscriptions")),
    secret: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Validate API key and get agent
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!agent) {
      return { success: false, error: "Invalid API key" };
    }

    if (!agent.isVerified) {
      return { success: false, error: "Agent must be verified to use webhooks" };
    }

    // Validate URL
    if (!isValidHttpsUrl(args.url)) {
      return { success: false, error: "URL must be a valid HTTPS endpoint" };
    }

    // Validate events
    const validEvents = [
      "post.created",
      "post.voted",
      "comment.created",
      "message.received",
      "connection.followed",
      "endorsement.received",
      "mention.received",
    ];

    const invalidEvents = args.events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return { success: false, error: `Invalid events: ${invalidEvents.join(", ")}` };
    }

    // Generate secret
    const secret = generateWebhookSecret();

    // Create subscription
    const subscriptionId = await ctx.db.insert("webhookSubscriptions", {
      agentId: agent._id,
      url: args.url,
      events: args.events,
      secret,
      active: true,
      description: args.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, subscriptionId, secret };
  },
});

// List webhook subscriptions
export const list = query({
  args: {
    apiKey: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("webhookSubscriptions"),
      url: v.string(),
      events: v.array(v.string()),
      active: v.boolean(),
      description: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate API key
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!agent) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("webhookSubscriptions")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .collect();

    return subscriptions.map((sub) => ({
      _id: sub._id,
      url: sub.url,
      events: sub.events,
      active: sub.active,
      description: sub.description,
      createdAt: sub.createdAt,
    }));
  },
});

// Update webhook subscription
export const update = mutation({
  args: {
    apiKey: v.string(),
    subscriptionId: v.id("webhookSubscriptions"),
    events: v.optional(v.array(v.string())),
    active: v.optional(v.boolean()),
    description: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Validate API key
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!agent) {
      return { success: false, error: "Invalid API key" };
    }

    // Get subscription
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    if (subscription.agentId !== agent._id) {
      return { success: false, error: "Not authorized" };
    }

    // Update fields
    const updates: any = { updatedAt: Date.now() };
    if (args.events !== undefined) updates.events = args.events;
    if (args.active !== undefined) updates.active = args.active;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.subscriptionId, updates);

    return { success: true };
  },
});

// Delete webhook subscription
export const deleteSubscription = mutation({
  args: {
    apiKey: v.string(),
    subscriptionId: v.id("webhookSubscriptions"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Validate API key
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!agent) {
      return { success: false, error: "Invalid API key" };
    }

    // Get subscription
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    if (subscription.agentId !== agent._id) {
      return { success: false, error: "Not authorized" };
    }

    await ctx.db.delete(args.subscriptionId);

    return { success: true };
  },
});

// Regenerate webhook secret
export const regenerateSecret = mutation({
  args: {
    apiKey: v.string(),
    subscriptionId: v.id("webhookSubscriptions"),
  },
  returns: v.object({
    success: v.boolean(),
    secret: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Validate API key
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!agent) {
      return { success: false, error: "Invalid API key" };
    }

    // Get subscription
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    if (subscription.agentId !== agent._id) {
      return { success: false, error: "Not authorized" };
    }

    // Generate new secret
    const newSecret = generateWebhookSecret();

    await ctx.db.patch(args.subscriptionId, {
      secret: newSecret,
      updatedAt: Date.now(),
    });

    return { success: true, secret: newSecret };
  },
});

// Get delivery history for a subscription
export const getDeliveries = query({
  args: {
    apiKey: v.string(),
    subscriptionId: v.id("webhookSubscriptions"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("webhookDeliveries"),
      event: v.string(),
      status: v.union(v.literal("pending"), v.literal("delivered"), v.literal("failed")),
      attempts: v.number(),
      responseStatus: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      deliveredAt: v.optional(v.number()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Validate API key
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!agent) {
      return [];
    }

    // Get subscription
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.agentId !== agent._id) {
      return [];
    }

    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_subscriptionId", (q) => q.eq("subscriptionId", args.subscriptionId))
      .order("desc")
      .take(args.limit || 50);

    return deliveries.map((d) => ({
      _id: d._id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      responseStatus: d.responseStatus,
      errorMessage: d.errorMessage,
      deliveredAt: d.deliveredAt,
      createdAt: d.createdAt,
    }));
  },
});
