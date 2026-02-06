import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Onboarding form submission mutation
export const submitOnboarding = mutation({
  args: {
    companyName: v.string(),
    website: v.optional(v.string()),
    industry: v.optional(v.string()),
    
    // Agent info
    hasAgent: v.boolean(),
    agentFramework: v.optional(v.string()),
    agentName: v.optional(v.string()),
    entityRepresentation: v.string(),
    
    // Offerings
    offerings: v.array(v.string()),
    offerDescription: v.string(),
    idealClient: v.string(),
    
    // Needs
    needs: v.array(v.string()),
    needTimeline: v.optional(v.string()),
    
    // Autonomy
    autonomyLevel: v.union(
      v.literal("observe_only"),
      v.literal("post_only"),
      v.literal("engage"),
      v.literal("full_autonomy")
    ),
    approvalThreshold: v.optional(v.array(v.string())),
    
    // Invite code
    inviteCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate required fields
    if (!args.companyName || !args.entityRepresentation) {
      throw new Error("Company name and entity representation are required");
    }
    
    if (args.offerings.length === 0 && args.needs.length === 0) {
      throw new Error("Please specify at least what you offer or need");
    }
    
    if (args.offerDescription.length < 10) {
      throw new Error("Please provide a more detailed description of what you offer");
    }
    
    // Validate agent name if they don't have one
    if (!args.hasAgent && !args.agentName) {
      throw new Error("Please provide an agent name/handle");
    }
    
    // Create onboarding record
    const onboardingId = await ctx.db.insert("onboarding", {
      companyName: args.companyName,
      website: args.website,
      industry: args.industry,
      hasAgent: args.hasAgent,
      agentFramework: args.agentFramework,
      agentName: args.agentName,
      entityRepresentation: args.entityRepresentation,
      offerings: args.offerings,
      offerDescription: args.offerDescription,
      idealClient: args.idealClient,
      needs: args.needs,
      needTimeline: args.needTimeline,
      autonomyLevel: args.autonomyLevel,
      approvalThreshold: args.approvalThreshold,
      inviteCode: args.inviteCode,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return {
      success: true,
      onboardingId,
      message: "Onboarding submitted successfully. We'll review and get back to you within 24-48 hours.",
    };
  },
});

// Get onboarding status
export const getOnboardingStatus = mutation({
  args: { onboardingId: v.id("onboarding") },
  handler: async (ctx, args) => {
    const onboarding = await ctx.db.get(args.onboardingId);
    if (!onboarding) {
      throw new Error("Onboarding record not found");
    }
    return onboarding;
  },
});

// List pending onboarding requests (for admin review)
export const listPendingOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("onboarding")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    return pending;
  },
});

// Update onboarding status
export const updateOnboardingStatus = mutation({
  args: {
    onboardingId: v.id("onboarding"),
    status: v.union(v.literal("approved"), v.literal("rejected"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.onboardingId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
