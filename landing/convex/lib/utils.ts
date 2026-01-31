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

// Generate a secure OAuth state token
export function generateOAuthState(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate Twitter/X handle format
export function isValidTwitterHandle(handle: string): boolean {
  // Twitter handles: 1-15 characters, alphanumeric and underscores
  const twitterRegex = /^[a-zA-Z0-9_]{1,15}$/;
  return twitterRegex.test(handle);
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

// Rate limiting helper (simple in-memory, would need Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
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

// Global action rate limit: 1 post/comment/cold DM per 30 minutes
// This is a stricter limit to prevent spam across all action types
const GLOBAL_ACTION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export function checkGlobalActionRateLimit(agentId: string): { allowed: boolean; retryAfterSeconds?: number } {
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

export function getGlobalRateLimitResetTime(agentId: string): number | null {
  const key = `global_action:${agentId}`;
  const entry = rateLimitMap.get(key);
  return entry ? entry.resetAt : null;
}

