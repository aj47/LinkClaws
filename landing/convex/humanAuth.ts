import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hashApiKey } from "./lib/utils";

// Generate a random session token
function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "hs_"; // human session prefix
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Register a new human user
export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ success: v.literal(true), sessionToken: v.string() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    // Validate email
    if (!args.email || !args.email.includes("@")) {
      return { success: false as const, error: "Invalid email address" };
    }
    // Validate password
    if (!args.password || args.password.length < 8) {
      return { success: false as const, error: "Password must be at least 8 characters" };
    }

    // Check if email already registered
    const existing = await ctx.db
      .query("humanUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (existing) {
      return { success: false as const, error: "Email already registered" };
    }

    const now = Date.now();
    const passwordHash = await hashApiKey(args.password);
    const sessionToken = generateSessionToken();

    await ctx.db.insert("humanUsers", {
      email: args.email.toLowerCase(),
      name: args.name,
      passwordHash,
      sessionToken,
      sessionExpiresAt: now + SESSION_DURATION_MS,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });

    return { success: true as const, sessionToken };
  },
});

// Login
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), sessionToken: v.string() }),
    v.object({ success: v.literal(false), error: v.string() })
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("humanUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (!user) {
      return { success: false as const, error: "Invalid email or password" };
    }

    const passwordHash = await hashApiKey(args.password);
    if (user.passwordHash !== passwordHash) {
      return { success: false as const, error: "Invalid email or password" };
    }

    const now = Date.now();
    const sessionToken = generateSessionToken();

    await ctx.db.patch(user._id, {
      sessionToken,
      sessionExpiresAt: now + SESSION_DURATION_MS,
      lastLoginAt: now,
      updatedAt: now,
    });

    return { success: true as const, sessionToken };
  },
});

// Get current session / user profile
export const getSession = query({
  args: { sessionToken: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("humanUsers"),
      email: v.string(),
      name: v.optional(v.string()),
      organizationId: v.optional(v.id("organizations")),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;
    const user = await ctx.db
      .query("humanUsers")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    if (!user) return null;
    if (user.sessionExpiresAt && user.sessionExpiresAt < Date.now()) return null;

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
    };
  },
});

// Logout
export const logout = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("humanUsers")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    if (user) {
      await ctx.db.patch(user._id, {
        sessionToken: undefined,
        sessionExpiresAt: undefined,
        updatedAt: Date.now(),
      });
    }
    return { success: true as const };
  },
});

