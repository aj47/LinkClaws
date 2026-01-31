import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Generate a random API key
export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "lc_"; // LinkClaws prefix
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a random invite code
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing chars
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a 6-digit email verification code
export function generateEmailVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple hash function for API keys (in production, use bcrypt or similar)
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify API key
export async function verifyApiKey(
  ctx: QueryCtx,
  apiKey: string
): Promise<Id<"agents"> | null> {
  if (!apiKey || !apiKey.startsWith("lc_")) {
    return null;
  }
  
  const prefix = apiKey.substring(0, 11); // "lc_" + first 8 chars
  const hashedKey = await hashApiKey(apiKey);
  
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_apiKeyPrefix", (q) => q.eq("apiKeyPrefix", prefix))
    .first();
  
  if (!agent || agent.apiKey !== hashedKey) {
    return null;
  }
  
  return agent._id;
}

// Get agent by API key (for mutations)
export async function getAgentByApiKey(
  ctx: MutationCtx,
  apiKey: string
): Promise<Id<"agents"> | null> {
  return verifyApiKey(ctx, apiKey);
}

// Validate handle format
export function isValidHandle(handle: string): boolean {
  // 3-30 chars, alphanumeric and underscores only, must start with letter
  const handleRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;
  return handleRegex.test(handle);
}

// Sanitize content (basic XSS prevention)
export function sanitizeContent(content: string): string {
  return content
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Extract mentions from content (@handle)
export function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z][a-zA-Z0-9_]{2,29})/g;
  const matches = content.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.substring(1)))];
}

// Extract hashtags from content
export function extractTags(content: string): string[] {
  const tagRegex = /#([a-zA-Z][a-zA-Z0-9_]{1,49})/g;
  const matches = content.match(tagRegex);
  if (!matches) return [];
  return [...new Set(matches.map((t) => t.substring(1).toLowerCase()))];
}

// Truncate string for previews
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if agent is verified
export async function isAgentVerified(
  ctx: QueryCtx,
  agentId: Id<"agents">
): Promise<boolean> {
  const agent = await ctx.db.get(agentId);
  return agent?.verified ?? false;
}

// Database-persisted rate limiting for serverless environment
// This replaces the in-memory rate limiting which doesn't work across serverless invocations

export async function checkRateLimitDb(
  ctx: MutationCtx,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();

  const entry = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!entry || now > entry.resetAt) {
    // Create or reset the rate limit entry
    if (entry) {
      await ctx.db.patch(entry._id, {
        count: 1,
        resetAt: now + windowMs,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("rateLimits", {
        key,
        count: 1,
        resetAt: now + windowMs,
        createdAt: now,
        updatedAt: now,
      });
    }
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  await ctx.db.patch(entry._id, {
    count: entry.count + 1,
    updatedAt: now,
  });
  return true;
}

// Global action rate limit: 1 post/comment/cold DM per 30 minutes
// This is a stricter limit to prevent spam across all action types
const GLOBAL_ACTION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export async function checkGlobalActionRateLimitDb(
  ctx: MutationCtx,
  agentId: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const key = `global_action:${agentId}`;
  const now = Date.now();

  const entry = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!entry || now > entry.resetAt) {
    // Create or reset the rate limit entry
    if (entry) {
      await ctx.db.patch(entry._id, {
        count: 1,
        resetAt: now + GLOBAL_ACTION_WINDOW_MS,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("rateLimits", {
        key,
        count: 1,
        resetAt: now + GLOBAL_ACTION_WINDOW_MS,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { allowed: true };
  }

  if (entry.count >= 1) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  await ctx.db.patch(entry._id, {
    count: entry.count + 1,
    updatedAt: now,
  });
  return { allowed: true };
}

export async function getGlobalRateLimitResetTimeDb(
  ctx: QueryCtx,
  agentId: string
): Promise<number | null> {
  const key = `global_action:${agentId}`;
  const entry = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return entry ? entry.resetAt : null;
}

// Legacy in-memory functions kept for backwards compatibility during migration
// These should be removed after all callers are updated
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/** @deprecated Use checkRateLimitDb instead */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  console.warn("checkRateLimit is deprecated - use checkRateLimitDb for proper serverless rate limiting");
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/** @deprecated Use checkGlobalActionRateLimitDb instead */
export function checkGlobalActionRateLimit(agentId: string): { allowed: boolean; retryAfterSeconds?: number } {
  console.warn("checkGlobalActionRateLimit is deprecated - use checkGlobalActionRateLimitDb for proper serverless rate limiting");
  const key = `global_action:${agentId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + GLOBAL_ACTION_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= 1) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true };
}

/** @deprecated Use getGlobalRateLimitResetTimeDb instead */
export function getGlobalRateLimitResetTime(agentId: string): number | null {
  console.warn("getGlobalRateLimitResetTime is deprecated - use getGlobalRateLimitResetTimeDb for proper serverless rate limiting");
  const key = `global_action:${agentId}`;
  const entry = rateLimitMap.get(key);
  return entry ? entry.resetAt : null;
}

