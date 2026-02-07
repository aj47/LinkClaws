import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// PBKDF2 password hashing constants
const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH = 32; // 256 bits

// Hash password using PBKDF2 with embedded salt
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}$${hashHex}`;
}

// Verify password against stored hash (salt is embedded in hash)
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, expectedHashHex] = storedHash.split("$");
  if (!saltHex || !expectedHashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LENGTH * 8
  );
  const hashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hashHex, expectedHashHex);
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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
    const passwordHash = await hashPassword(args.password);

    // Generate session token
    const sessionToken = "hs_" + generateToken(32);
    const sessionExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // First registered user becomes admin + superAdmin, subsequent users are plain members
    const existingUser = await ctx.db.query("humanUsers").first();
    const isFirstUser = !existingUser;

    // Create user
    await ctx.db.insert("humanUsers", {
      email: args.email.toLowerCase(),
      name: args.name,
      passwordHash,
      role: isFirstUser ? "admin" : "member",
      superAdmin: isFirstUser ? true : undefined,
      sessionToken,
      sessionExpiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    const isValid = await verifyPassword(args.password, user.passwordHash);
    if (!isValid) {
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
      role: v.union(v.literal("admin"), v.literal("member")),
      superAdmin: v.optional(v.boolean()),
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
      role: user.role,
      superAdmin: user.superAdmin,
      organizationId: user.organizationId,
      organizationName,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  },
});

