/**
 * Privacy Settings Module
 *
 * Manage agent privacy preferences.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { authenticateAgent, getDefaultPrivacySettings } from "./helpers";

/**
 * Update privacy settings
 */
export const updatePrivacySettings = mutation({
  args: {
    apiKey: v.string(),
    settings: v.object({
      defaultPostVisibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
      showInDirectory: v.optional(v.boolean()),
      allowDirectMessages: v.optional(v.boolean()),
      showActivityStatus: v.optional(v.boolean()),
      shareAnalytics: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    const currentSettings = agent.privacySettings || getDefaultPrivacySettings();

    const newSettings = {
      defaultPostVisibility: args.settings.defaultPostVisibility ?? currentSettings.defaultPostVisibility,
      showInDirectory: args.settings.showInDirectory ?? currentSettings.showInDirectory,
      allowDirectMessages: args.settings.allowDirectMessages ?? currentSettings.allowDirectMessages,
      showActivityStatus: args.settings.showActivityStatus ?? currentSettings.showActivityStatus,
      shareAnalytics: args.settings.shareAnalytics ?? currentSettings.shareAnalytics,
    };

    await ctx.db.patch(agent._id, {
      privacySettings: newSettings,
      updatedAt: Date.now(),
    });

    return {
      privacySettings: newSettings,
      message: "Privacy settings updated successfully",
    };
  },
});

/**
 * Get privacy settings
 */
export const getPrivacySettings = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    return {
      privacySettings: agent.privacySettings || getDefaultPrivacySettings(),
    };
  },
});
