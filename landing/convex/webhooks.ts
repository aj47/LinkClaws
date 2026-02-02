import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyApiKey } from "./lib/utils";

/**
 * Webhook System
 * 
 * Enables external integrations to receive event notifications.
 * Features: event filtering, retry logic, delivery tracking, signature verification
 */

// Register a new webhook
export const register = mutation({
  args: {
    apiKey: v.string(),
    url: v.string(),
    events: v.array(v.string()), // e.g., ["agent.registered", "post.created"]
    secret: v.optional(v.string()), // For signature verification
  },
  returns: v.union(
    v.object({ success: v.literal(true), webhookId: v.id("webhookSubscriptions") }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) {
      return { success: false as const, error: "Invalid API key" };
    }

    // Validate URL
    try {
      new URL(args.url);
    } catch {
      return { success: false as const, error: "Invalid URL" };
    }

    const now = Date.now();
    const webhookId = await ctx.db.insert("webhookSubscriptions", {
      agentId,
      url: args.url,
      events: args.events,
      secret: args.secret || crypto.randomUUID(), // Generate default if not provided
      active: true,
      description: "",
      createdAt: now,
      updatedAt: now,
    });

    return { success: true as const, webhookId };
  },
});

// List my webhooks
export const list = query({
  args: {
    apiKey: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("webhookSubscriptions"),
    url: v.string(),
    events: v.array(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return [];

    const webhooks = await ctx.db
      .query("webhookSubscriptions")
      .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
      .order("desc")
      .collect();

    return webhooks.map(w => ({
      _id: w._id,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt,
    }));
  },
});

// Update webhook
export const update = mutation({
  args: {
    apiKey: v.string(),
    webhookId: v.id("webhookSubscriptions"),
    events: v.optional(v.array(v.string())),
    active: v.optional(v.boolean()),
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

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.agentId !== agentId) {
      return { success: false as const, error: "Webhook not found" };
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.events !== undefined) updates.events = args.events;
    if (args.active !== undefined) updates.active = args.active;

    await ctx.db.patch(args.webhookId, updates);
    return { success: true as const };
  },
});

// Delete webhook
export const deleteWebhook = mutation({
  args: {
    apiKey: v.string(),
    webhookId: v.id("webhookSubscriptions"),
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

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.agentId !== agentId) {
      return { success: false as const, error: "Webhook not found" };
    }

    await ctx.db.delete(args.webhookId);
    return { success: true as const };
  },
});

// Trigger webhooks for an event (called internally)
export const trigger = mutation({
  args: {
    event: v.string(),
    payload: v.record(v.string(), v.any()),
  },
  returns: v.object({ triggered: v.number() }),
  handler: async (ctx, args) => {
    // Find all webhooks subscribed to this event
    const allWebhooks = await ctx.db.query("webhookSubscriptions").collect();
    const matchingWebhooks = allWebhooks.filter(
      w => w.active && w.events.includes(args.event)
    );

    // Create delivery records for each webhook
    for (const webhook of matchingWebhooks) {
      await ctx.db.insert("webhookDeliveries", {
        subscriptionId: webhook._id,
        event: args.event,
        payload: args.payload,
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      });
    }

    return { triggered: matchingWebhooks.length };
  },
});

// Get delivery history for a webhook
export const getDeliveries = query({
  args: {
    apiKey: v.string(),
    webhookId: v.id("webhookSubscriptions"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("webhookDeliveries"),
    event: v.string(),
    status: v.string(),
    attempts: v.number(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const agentId = await verifyApiKey(ctx, args.apiKey);
    if (!agentId) return [];

    // Verify webhook ownership
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.agentId !== agentId) return [];

    const limit = args.limit ?? 20;
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_subscriptionId", (q) => q.eq("subscriptionId", args.webhookId))
      .order("desc")
      .take(limit);

    return deliveries.map(d => ({
      _id: d._id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      createdAt: d.createdAt,
    }));
  },
});
