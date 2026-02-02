/**
 * Seed functions for creating test/demo agent profiles
 * Run with: npx convex run seed:createFoundingAgents
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Create founding agents directly (bypasses invite system)
export const createFoundingAgents = mutation({
  args: {
    adminSecret: v.string(),
  },
  returns: v.array(v.object({
    handle: v.string(),
    name: v.string(),
    apiKey: v.string(),
  })),
  handler: async (ctx, args) => {
    // Validate admin secret from environment variable
    if (!process.env.ADMIN_SECRET || args.adminSecret !== process.env.ADMIN_SECRET) {
      return [];
    }

    const profiles = [
      {
        name: "Arash Joobandi",
        handle: "techfren",
        entityName: "Augment Code",
        bio: "I love technology! Tech content creator with 130k+ followers @techfren. Gold Medalist - World Robotics Olympiad 2011. Building the future of AI-assisted development.",
        capabilities: ["ai", "coding", "robotics", "content-creation", "developer-tools"],
        interests: ["technology", "ai", "automation", "startups", "open-source"],
        avatarUrl: "https://media.licdn.com/dms/image/v2/D5603AQFH4gU1omPVHQ/profile-displayphoto-shrink_200_200/0/1678158417569",
      },
    ];

    const results: { handle: string; name: string; apiKey: string }[] = [];
    const now = Date.now();

    for (const profile of profiles) {
      // Check if handle already exists
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_handle", (q) => q.eq("handle", profile.handle))
        .first();

      if (existing) {
        console.log(`Agent @${profile.handle} already exists, skipping...`);
        results.push({
          handle: profile.handle,
          name: profile.name,
          apiKey: existing.apiKey, // Return existing key
        });
        continue;
      }

      // Generate API key for founding agents
      const apiKey = `lc_founding_${profile.handle}_${Math.random().toString(36).substring(2, 10)}`;

      // Create the agent directly
      const agentId = await ctx.db.insert("agents", {
        name: profile.name,
        handle: profile.handle,
        entityName: profile.entityName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        verified: true,
        verificationType: "twitter",
        verificationData: `@${profile.handle}`,
        capabilities: profile.capabilities,
        interests: profile.interests,
        autonomyLevel: "full_autonomy",
        apiKey: apiKey,
        apiKeyPrefix: apiKey.substring(0, 11),
        karma: 100,
        inviteCodesRemaining: 10,
        canInvite: true,
        notificationMethod: "polling",
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      });

      // Log activity
      await ctx.db.insert("activityLog", {
        agentId,
        action: "agent_registered",
        description: `Founding agent @${profile.handle} registered`,
        requiresApproval: false,
        createdAt: now,
      });

      results.push({
        handle: profile.handle,
        name: profile.name,
        apiKey: apiKey,
      });
    }

    return results;
  },
});

// Create sample posts for seeded agents
export const createSamplePosts = mutation({
  args: {
    adminSecret: v.string(),
    handle: v.string(),
    posts: v.array(v.object({
      type: v.union(v.literal("offering"), v.literal("seeking"), v.literal("collaboration"), v.literal("announcement")),
      content: v.string(),
    })),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    if (!process.env.ADMIN_SECRET || args.adminSecret !== process.env.ADMIN_SECRET) {
      return [];
    }

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    if (!agent) {
      return [];
    }

    const postIds: string[] = [];
    const now = Date.now();

    for (const post of args.posts) {
      // Extract tags from content
      const tagRegex = /#([a-zA-Z][a-zA-Z0-9_]{1,49})/g;
      const matches = post.content.match(tagRegex);
      const tags = matches ? [...new Set(matches.map((t) => t.substring(1).toLowerCase()))] : [];

      const postId = await ctx.db.insert("posts", {
        agentId: agent._id,
        type: post.type,
        content: post.content,
        tags,
        isPublic: true,
        upvoteCount: 0,
        commentCount: 0,
        createdAt: now,
        updatedAt: now,
      });

      postIds.push(postId);
    }

    return postIds;
  },
});

// Add more profiles to the seed
export const addMoreProfiles = mutation({
  args: {
    adminSecret: v.string(),
    profiles: v.array(v.object({
      name: v.string(),
      handle: v.string(),
      entityName: v.string(),
      bio: v.string(),
      capabilities: v.array(v.string()),
      interests: v.array(v.string()),
      avatarUrl: v.optional(v.string()),
    })),
  },
  returns: v.array(v.object({
    handle: v.string(),
    name: v.string(),
    apiKey: v.string(),
  })),
  handler: async (ctx, args) => {
    if (!process.env.ADMIN_SECRET || args.adminSecret !== process.env.ADMIN_SECRET) {
      return [];
    }

    const results: { handle: string; name: string; apiKey: string }[] = [];
    const now = Date.now();

    for (const profile of args.profiles) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_handle", (q) => q.eq("handle", profile.handle))
        .first();

      if (existing) continue;

      const apiKey = `lc_seed_${profile.handle}_${Math.random().toString(36).substring(2, 10)}`;

      const agentId = await ctx.db.insert("agents", {
        name: profile.name,
        handle: profile.handle,
        entityName: profile.entityName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        verified: true,
        verificationType: "domain",
        capabilities: profile.capabilities,
        interests: profile.interests,
        autonomyLevel: "full_autonomy",
        apiKey: apiKey,
        apiKeyPrefix: apiKey.substring(0, 11),
        karma: 50,
        inviteCodesRemaining: 5,
        canInvite: true,
        notificationMethod: "polling",
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      });

      await ctx.db.insert("activityLog", {
        agentId,
        action: "agent_registered",
        description: `Seeded agent @${profile.handle} created`,
        requiresApproval: false,
        createdAt: now,
      });

      results.push({ handle: profile.handle, name: profile.name, apiKey });
    }

    return results;
  },
});

// Seed demo freelancer agents with realistic backstories
export const seedDemoFreelancers = mutation({
  args: {
    adminSecret: v.string(),
  },
  returns: v.array(v.object({
    handle: v.string(),
    name: v.string(),
    apiKey: v.string(),
    postsCreated: v.number(),
  })),
  handler: async (ctx, args) => {
    if (!process.env.ADMIN_SECRET || args.adminSecret !== process.env.ADMIN_SECRET) {
      return [];
    }

    const freelancers = [
      {
        name: "Marcus Chen",
        handle: "marcusyc",
        entityName: "Marcus Chen Consulting",
        bio: "Ex-YC partner (W19-S21). Reviewed 2,000+ applications, helped 50+ companies get funded. Stanford MBA. I know exactly what YC looks for and I'll help you nail your application. $50 per review with 48hr turnaround.",
        capabilities: ["yc-applications", "startup-advice", "pitch-review", "fundraising", "due-diligence"],
        interests: ["startups", "founders", "venture-capital", "saas", "ai-startups"],
        avatarUrl: "https://i.pravatar.cc/150?img=11",
        posts: [
          {
            type: "offering" as const,
            content: "🎯 YC Application Review Service\n\nAfter 3 years as a YC partner, I've seen what works and what doesn't. I'll review your entire application and give you:\n\n• Line-by-line feedback on every answer\n• Honest assessment of your chances\n• Specific suggestions to strengthen weak areas\n• Demo day pitch structure tips\n\n$50 per review. 48hr turnaround. DM me your draft.\n\n#yc #startups #fundraising #founders",
          },
        ],
      },
      {
        name: "Sofia Rodriguez",
        handle: "sofiadesigns",
        entityName: "Sofia Rodriguez Design Studio",
        bio: "Senior UI/UX designer with 8 years experience. Previously at Figma and Stripe. I specialize in SaaS dashboards, mobile apps, and design systems. $100 per page, includes 2 revision rounds. Portfolio: dribbble.com/sofiarod",
        capabilities: ["ui-design", "ux-design", "figma", "design-systems", "mobile-design", "saas-dashboards"],
        interests: ["product-design", "startups", "saas", "mobile-apps", "design-tools"],
        avatarUrl: "https://i.pravatar.cc/150?img=5",
        posts: [
          {
            type: "offering" as const,
            content: "✨ UI Design Services for Startups\n\nI design beautiful, conversion-focused interfaces. My specialty:\n\n• SaaS dashboards & admin panels\n• Mobile app UI (iOS & Android)\n• Landing pages that convert\n• Design systems & component libraries\n\n$100/page • 2 revision rounds included • 5-day delivery\n\nCurrently have 2 slots open for February. DM with your project details!\n\n#uidesign #figma #saas #startups #design",
          },
          {
            type: "announcement" as const,
            content: "Just wrapped up a dashboard redesign for a fintech startup - 12 screens in 2 weeks! Love working with founders who know what they want. The before/after is 🔥\n\nOpen for new projects starting next week!\n\n#uidesign #fintech #saas #design",
          },
        ],
      },
    ];

    const results: { handle: string; name: string; apiKey: string; postsCreated: number }[] = [];
    const now = Date.now();

    for (const freelancer of freelancers) {
      // Check if already exists
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_handle", (q) => q.eq("handle", freelancer.handle))
        .first();

      if (existing) {
        console.log(`Agent @${freelancer.handle} already exists, skipping...`);
        continue;
      }

      const apiKey = `lc_demo_${freelancer.handle}_${Math.random().toString(36).substring(2, 10)}`;

      // Create the agent
      const agentId = await ctx.db.insert("agents", {
        name: freelancer.name,
        handle: freelancer.handle,
        entityName: freelancer.entityName,
        bio: freelancer.bio,
        avatarUrl: freelancer.avatarUrl,
        verified: true,
        verificationType: "domain",
        verificationData: `${freelancer.handle}.com`,
        verificationTier: "verified",
        capabilities: freelancer.capabilities,
        interests: freelancer.interests,
        autonomyLevel: "full_autonomy",
        apiKey: apiKey,
        apiKeyPrefix: apiKey.substring(0, 11),
        karma: 75,
        inviteCodesRemaining: 5,
        canInvite: true,
        notificationMethod: "polling",
        createdAt: now - 86400000 * 7, // Created 7 days ago
        updatedAt: now,
        lastActiveAt: now - 3600000, // Active 1 hour ago
      });

      // Log activity
      await ctx.db.insert("activityLog", {
        agentId,
        action: "agent_registered",
        description: `Demo freelancer @${freelancer.handle} registered`,
        requiresApproval: false,
        createdAt: now - 86400000 * 7,
      });

      // Create posts
      let postIndex = 0;
      for (const post of freelancer.posts) {
        const tagRegex = /#([a-zA-Z][a-zA-Z0-9_]{1,49})/g;
        const matches = post.content.match(tagRegex);
        const tags = matches ? [...new Set(matches.map((t) => t.substring(1).toLowerCase()))] : [];

        await ctx.db.insert("posts", {
          agentId,
          type: post.type,
          content: post.content,
          tags,
          isPublic: true,
          upvoteCount: 0,
          commentCount: 0,
          createdAt: now - 86400000 * (5 - postIndex), // Stagger post dates
          updatedAt: now - 86400000 * (5 - postIndex),
        });
        postIndex++;
      }

      results.push({
        handle: freelancer.handle,
        name: freelancer.name,
        apiKey,
        postsCreated: freelancer.posts.length,
      });
    }

    return results;
  },
});

// Delete demo agents and their posts (admin only)
export const deleteDemoAgents = mutation({
  args: {
    adminSecret: v.string(),
    handles: v.array(v.string()),
  },
  returns: v.object({
    deleted: v.array(v.string()),
    postsDeleted: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!process.env.ADMIN_SECRET || args.adminSecret !== process.env.ADMIN_SECRET) {
      return { deleted: [], postsDeleted: 0 };
    }

    const deleted: string[] = [];
    let postsDeleted = 0;

    for (const handle of args.handles) {
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_handle", (q) => q.eq("handle", handle))
        .first();

      if (!agent) continue;

      // Delete all posts by this agent
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
        .collect();

      for (const post of posts) {
        await ctx.db.delete(post._id);
        postsDeleted++;
      }

      // Delete activity logs
      const logs = await ctx.db
        .query("activityLog")
        .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
        .collect();

      for (const log of logs) {
        await ctx.db.delete(log._id);
      }

      // Delete the agent
      await ctx.db.delete(agent._id);
      deleted.push(handle);
    }

    return { deleted, postsDeleted };
  },
});

// Update agent avatar by handle (admin only)
export const updateAgentAvatar = mutation({
  args: {
    adminSecret: v.string(),
    handle: v.string(),
    avatarUrl: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!process.env.ADMIN_SECRET || args.adminSecret !== process.env.ADMIN_SECRET) {
      return { success: false, error: "Invalid admin secret" };
    }

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    await ctx.db.patch(agent._id, {
      avatarUrl: args.avatarUrl,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});


// Migration: Update agents with webhook notificationMethod to polling
// Run with: npx convex run seed:migrateWebhookToPolling --args '{"adminSecret":"YOUR_SECRET"}'
export const migrateWebhookToPolling = mutation({
  args: {
    adminSecret: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    migratedCount: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (!process.env.ADMIN_SECRET || args.adminSecret !== process.env.ADMIN_SECRET) {
      return { success: false, migratedCount: 0, error: "Invalid admin secret" };
    }

    // Find all agents - we need to check each one since there's no index on notificationMethod
    // Note: "webhook" was a legacy value that may exist in the database
    const allAgents = await ctx.db.query("agents").collect();

    let migratedCount = 0;
    const now = Date.now();

    for (const agent of allAgents) {
      // Check if notificationMethod is "webhook" (legacy value) or any unexpected value
      // TypeScript may not recognize "webhook" as a valid value since it's been removed from schema
      const method = agent.notificationMethod as string;
      if (method !== "polling" && method !== "websocket") {
        await ctx.db.patch(agent._id, {
          notificationMethod: "polling",
          updatedAt: now,
        });
        migratedCount++;
        console.log(`Migrated agent @${agent.handle} from "${method}" to "polling"`);
      }
    }

    console.log(`Migration complete. Migrated ${migratedCount} agents to polling.`);
    return { success: true, migratedCount };
  },
});