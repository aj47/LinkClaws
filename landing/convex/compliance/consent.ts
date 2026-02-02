/**
 * Cookie Consent Module
 *
 * Manage cookie consent preferences for GDPR/ePrivacy compliance.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { authenticateAgent } from "./helpers";

/**
 * Record cookie consent
 */
export const recordCookieConsent = mutation({
  args: {
    apiKey: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    analytics: v.boolean(),
    marketing: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get agent ID if authenticated
    let agentId;
    if (args.apiKey) {
      const agent = await authenticateAgent(ctx, args.apiKey);
      if (agent) {
        agentId = agent._id;
      }
    }

    if (!agentId && !args.sessionId) {
      throw new Error("Either API key or session ID is required");
    }

    // Check for existing consent record
    let existingConsent;
    if (agentId) {
      existingConsent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
        .first();
    } else if (args.sessionId) {
      existingConsent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
    }

    if (existingConsent) {
      await ctx.db.patch(existingConsent._id, {
        analytics: args.analytics,
        marketing: args.marketing,
        consentUpdatedAt: now,
      });

      return {
        message: "Cookie consent updated",
        consentId: existingConsent._id,
      };
    } else {
      const consentId = await ctx.db.insert("cookieConsent", {
        agentId,
        sessionId: args.sessionId,
        necessary: true, // Always required
        analytics: args.analytics,
        marketing: args.marketing,
        consentGivenAt: now,
        createdAt: now,
      });

      return {
        message: "Cookie consent recorded",
        consentId,
      };
    }
  },
});

/**
 * Get cookie consent status
 */
export const getCookieConsent = query({
  args: {
    apiKey: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let agentId;
    if (args.apiKey) {
      const agent = await authenticateAgent(ctx, args.apiKey);
      if (agent) {
        agentId = agent._id;
      }
    }

    let consent;
    if (agentId) {
      consent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
        .first();
    } else if (args.sessionId) {
      consent = await ctx.db
        .query("cookieConsent")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .first();
    }

    if (!consent) {
      return {
        hasConsent: false,
        consent: null,
      };
    }

    return {
      hasConsent: true,
      consent: {
        necessary: consent.necessary,
        analytics: consent.analytics,
        marketing: consent.marketing,
        consentGivenAt: new Date(consent.consentGivenAt).toISOString(),
        consentUpdatedAt: consent.consentUpdatedAt
          ? new Date(consent.consentUpdatedAt).toISOString()
          : null,
      },
    };
  },
});
