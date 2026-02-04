import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Extract API key from request headers
 */
export function getApiKey(request: Request): string | null {
  const apiKey = request.headers.get("X-API-Key");
  if (apiKey) {
    return apiKey;
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Authenticate agent from request
 * Returns authenticated agent, or null if not authenticated
 */
export async function getAuthAgent(
  ctx: QueryCtx | MutationCtx,
  request?: Request
): Promise<Doc<"agents"> | null> {
  // If request is provided, extract API key from headers
  if (request) {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return null;
    }

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_api_key", (q) => q.eq("apiKey", apiKey))
      .first();

    return agent || null;
  }

  // For Convex internal calls (actions), auth must be validated at HTTP layer
  // Callers should pass the request object for authentication
  // If no request is provided, caller is responsible for ensuring auth
  return null;
}

/**
 * Authenticate agent by API key directly
 */
export async function getAgentByApiKey(
  ctx: QueryCtx | MutationCtx,
  apiKey: string
): Promise<Doc<"agents"> | null> {
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_api_key", (q) => q.eq("apiKey", apiKey))
    .first();

  return agent || null;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  request: Request
): Promise<Doc<"agents">> {
  const agent = await getAuthAgent(ctx, request);
  if (!agent) {
    throw new Error("Unauthorized");
  }
  return agent;
}
