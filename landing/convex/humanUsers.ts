import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to hash password with salt
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate a random string
function generateToken(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length];
  }
  return result;
}

// Verify session token and return user ID
export async function verifyHumanSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string
): Promise<Id<"humanUsers"> | null> {
  if (!sessionToken || !sessionToken.startsWith("hs_")) {
    return null;
  }

  const user = await ctx.db
    .query("humanUsers")
    .withIndex("by_sessionToken", (q) => q.eq("sessionToken", sessionToken))
    .first();

  if (!user || !user.sessionExpiresAt || user.sessionExpiresAt < Date.now()) {
    return null;
  }

  return user._id;
}

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
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      return { success: false as const, error: "Invalid email format" };
    }

    // Check password strength
    if (args.password.length < 8) {
      return { success: false as const, error: "Password must be at least 8 characters" };
    }

    // Check if email already exists
    const existing = await ctx.db
      .query("humanUsers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existing) {
      return { success: false as const, error: "Email already registered" };
    }

    // Hash password
    const salt = generateToken(16);
    const passwordHash = await hashPassword(args.password, salt);

    // Generate session token
    const sessionToken = "hs_" + generateToken(32);
    const sessionExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Create user
    await ctx.db.insert("humanUsers", {
      email: args.email.toLowerCase(),
      name: args.name,
      passwordHash,
      passwordSalt: salt,
      sessionToken,
      sessionExpiresAt,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
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

    // Verify password
    const passwordHash = await hashPassword(args.password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) {
      return { success: false as const, error: "Invalid email or password" };
    }

    // Generate new session
    const sessionToken = "hs_" + generateToken(32);
    const sessionExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(user._id, {
      sessionToken,
      sessionExpiresAt,
      lastLoginAt: Date.now(),
    });

    return { success: true as const, sessionToken };
  },
});

// Logout
export const logout = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) {
      return { success: false };
    }

    await ctx.db.patch(userId, {
      sessionToken: undefined,
      sessionExpiresAt: undefined,
    });

    return { success: true };
  },
});

// Get current user info
export const getMe = query({
  args: { sessionToken: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("humanUsers"),
      email: v.string(),
      name: v.optional(v.string()),
      organizationId: v.optional(v.id("organizations")),
      organizationName: v.optional(v.string()),
      createdAt: v.number(),
      lastLoginAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await verifyHumanSession(ctx, args.sessionToken);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    let organizationName: string | undefined;
    if (user.organizationId) {
      const org = await ctx.db.get(user.organizationId);
      organizationName = org?.name;
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      organizationName,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  },
});

