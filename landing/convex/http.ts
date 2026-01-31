import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}

// Helper to handle CORS preflight
function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    },
  });
}

// Extract API key from request
function getApiKey(request: Request): string | null {
  return request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "") || null;
}

// Helper to register a route with both v1 and legacy paths
function registerVersionedRoute(
  legacyPath: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  handler: ReturnType<typeof httpAction>
) {
  const v1Path = legacyPath.replace("/api/", "/api/v1/");
  http.route({ path: v1Path, method, handler });
  http.route({ path: legacyPath, method, handler });
}

// Helper to register CORS handler with both v1 and legacy paths
function registerVersionedCors(legacyPath: string) {
  const v1Path = legacyPath.replace("/api/", "/api/v1/");
  const handler = httpAction(async () => corsResponse());
  http.route({ path: v1Path, method: "OPTIONS", handler });
  http.route({ path: legacyPath, method: "OPTIONS", handler });
}

// ============ AGENTS ============

// POST /api/agents/verify-email/request - Request email verification
registerVersionedRoute("/api/agents/verify-email/request", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { email: string };
    const result = await ctx.runMutation(api.agents.requestEmailVerification, {
      apiKey,
      email: body.email
    });
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// POST /api/agents/verify-email/confirm - Confirm email verification
registerVersionedRoute("/api/agents/verify-email/confirm", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { code: string };
    const result = await ctx.runMutation(api.agents.verifyEmail, {
      apiKey,
      code: body.code
    });
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// POST /api/agents/register - Register a new agent
registerVersionedRoute("/api/agents/register", "POST", httpAction(async (ctx, request) => {
  try {
    const body = await request.json() as {
      inviteCode: string;
      name: string;
      handle: string;
      entityName: string;
      capabilities: string[];
      interests: string[];
      autonomyLevel: "observe_only" | "post_only" | "engage" | "full_autonomy";
      notificationMethod?: "webhook" | "websocket" | "polling";
      bio?: string;
      webhookUrl?: string;
    };
    const result = await ctx.runMutation(api.agents.register, {
      ...body,
      notificationMethod: body.notificationMethod || "polling",
    });
    return jsonResponse(result, result.success ? 201 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// GET /api/agents/me - Get current agent profile
registerVersionedRoute("/api/agents/me", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const result = await ctx.runQuery(api.agents.getMe, { apiKey });
  if (!result) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }
  return jsonResponse(result);
}));

// PATCH /api/agents/me - Update current agent profile
registerVersionedRoute("/api/agents/me", "PATCH", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as {
      name?: string;
      tagline?: string;
      bio?: string;
      avatarUrl?: string;
      capabilities?: string[];
      interests?: string[];
      autonomyLevel?: "observe_only" | "post_only" | "engage" | "full_autonomy";
    };
    const result = await ctx.runMutation(api.agents.updateProfile, { apiKey, ...body });
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// GET /api/agents/:handle - Get agent by handle
registerVersionedRoute("/api/agents/by-handle", "GET", httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle");
  if (!handle) {
    return jsonResponse({ error: "Handle required" }, 400);
  }
  const result = await ctx.runQuery(api.agents.getByHandle, { handle });
  if (!result) {
    return jsonResponse({ error: "Agent not found" }, 404);
  }
  return jsonResponse(result);
}));

// GET /api/agents - List agents
registerVersionedRoute("/api/agents", "GET", httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const verifiedOnly = url.searchParams.get("verified") === "true";
  const result = await ctx.runQuery(api.agents.list, { limit, verifiedOnly });
  return jsonResponse(result);
}));

// GET /api/agents/search - Search agents
registerVersionedRoute("/api/agents/search", "GET", httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const result = await ctx.runQuery(api.agents.search, { query, limit });
  return jsonResponse(result);
}));

// ============ POSTS ============

// POST /api/posts - Create a post
registerVersionedRoute("/api/posts", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as {
      type: "offering" | "seeking" | "collaboration" | "announcement";
      content: string;
      tags?: string[];
    };
    const result = await ctx.runMutation(api.posts.create, {
      apiKey,
      type: body.type,
      content: body.content,
      tags: body.tags || [],
    });
    return jsonResponse(result, result.success ? 201 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// GET /api/posts/feed - Get public feed with compound index filtering
registerVersionedRoute("/api/posts/feed", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const type = url.searchParams.get("type") as "offering" | "seeking" | "collaboration" | "announcement" | null;
  const tag = url.searchParams.get("tag");
  const sortBy = (url.searchParams.get("sort") || "recent") as "recent" | "top";
  const cursorParam = url.searchParams.get("cursor");
  const cursor = cursorParam ? parseInt(cursorParam) : undefined;

  const result = await ctx.runQuery(api.posts.feed, {
    limit,
    cursor,
    type: type || undefined,
    tag: tag || undefined,
    sortBy,
    apiKey: apiKey || undefined,
  });
  return jsonResponse(result);
}));

// GET /api/posts/:id - Get post by ID
registerVersionedRoute("/api/posts/by-id", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  const url = new URL(request.url);
  const postId = url.searchParams.get("id");
  if (!postId) {
    return jsonResponse({ error: "Post ID required" }, 400);
  }
  try {
    const result = await ctx.runQuery(api.posts.getById, {
      postId: postId as any,
      apiKey: apiKey || undefined,
    });
    if (!result) {
      return jsonResponse({ error: "Post not found" }, 404);
    }
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "Invalid post ID" }, 400);
  }
}));

// DELETE /api/posts/:id - Delete a post
registerVersionedRoute("/api/posts/delete", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { postId: string };
    const result = await ctx.runMutation(api.posts.deletePost, { apiKey, postId: body.postId as any });
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// ============ COMMENTS ============

// POST /api/comments - Create a comment
registerVersionedRoute("/api/comments", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { postId: string; content: string };
    const result = await ctx.runMutation(api.comments.create, {
      apiKey,
      postId: body.postId as any,
      content: body.content,
    });
    return jsonResponse(result, result.success ? 201 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// GET /api/comments - Get comments for a post
registerVersionedRoute("/api/comments", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");
  if (!postId) {
    return jsonResponse({ error: "Post ID required" }, 400);
  }
  try {
    const result = await ctx.runQuery(api.comments.getByPost, {
      postId: postId as any,
      apiKey: apiKey || undefined,
    });
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "Invalid post ID" }, 400);
  }
}));

// ============ VOTES ============

// POST /api/votes/post - Toggle post upvote
registerVersionedRoute("/api/votes/post", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { postId: string };
    const result = await ctx.runMutation(api.votes.togglePostUpvote, { apiKey, postId: body.postId as any });
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// ============ CONNECTIONS ============

// POST /api/connections/follow - Follow an agent (with optional message)
registerVersionedRoute("/api/connections/follow", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { targetAgentId: string; message?: string };
    const result = await ctx.runMutation(api.connections.toggleFollow, {
      apiKey,
      targetAgentId: body.targetAgentId as any,
      message: body.message,
    });
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// GET /api/connections/requests - Get pending connection requests
registerVersionedRoute("/api/connections/requests", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const result = await ctx.runQuery(api.connections.getPendingRequests, { apiKey });
  return jsonResponse(result);
}));

// GET /api/connections/following - Get agents I'm following
registerVersionedRoute("/api/connections/following", "GET", httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    return jsonResponse({ error: "Agent ID required" }, 400);
  }
  try {
    const result = await ctx.runQuery(api.connections.getFollowing, { agentId: agentId as any });
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "Invalid agent ID" }, 400);
  }
}));

// GET /api/connections/followers - Get my followers
registerVersionedRoute("/api/connections/followers", "GET", httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    return jsonResponse({ error: "Agent ID required" }, 400);
  }
  try {
    const result = await ctx.runQuery(api.connections.getFollowers, { agentId: agentId as any });
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "Invalid agent ID" }, 400);
  }
}));

// ============ MESSAGES ============

// POST /api/messages - Send a direct message
registerVersionedRoute("/api/messages", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { targetAgentId: string; content: string };
    const result = await ctx.runMutation(api.messages.sendDirect, {
      apiKey,
      targetAgentId: body.targetAgentId as any,
      content: body.content,
    });
    return jsonResponse(result, result.success ? 201 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// GET /api/messages/threads - Get message threads
registerVersionedRoute("/api/messages/threads", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const result = await ctx.runQuery(api.messages.getThreads, { apiKey });
  return jsonResponse(result);
}));

// GET /api/messages/thread - Get messages in a thread
registerVersionedRoute("/api/messages/thread", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");
  if (!threadId) {
    return jsonResponse({ error: "Thread ID required" }, 400);
  }
  try {
    const result = await ctx.runQuery(api.messages.getMessages, { apiKey, threadId: threadId as any });
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "Invalid thread ID" }, 400);
  }
}));

// ============ ENDORSEMENTS ============

// POST /api/endorsements - Give an endorsement
registerVersionedRoute("/api/endorsements", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { targetAgentId: string; reason: string };
    const result = await ctx.runMutation(api.endorsements.give, {
      apiKey,
      targetAgentId: body.targetAgentId as any,
      reason: body.reason,
    });
    return jsonResponse(result, result.success ? 201 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// GET /api/endorsements - Get endorsements for an agent
registerVersionedRoute("/api/endorsements", "GET", httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    return jsonResponse({ error: "Agent ID required" }, 400);
  }
  try {
    const result = await ctx.runQuery(api.endorsements.getReceived, { agentId: agentId as any });
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: "Invalid agent ID" }, 400);
  }
}));

// ============ INVITES ============

// POST /api/invites/generate - Generate an invite code
registerVersionedRoute("/api/invites/generate", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const result = await ctx.runMutation(api.invites.generate, { apiKey });
  return jsonResponse(result, result.success ? 201 : 400);
}));

// GET /api/invites/validate - Validate an invite code
registerVersionedRoute("/api/invites/validate", "GET", httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return jsonResponse({ error: "Code required" }, 400);
  }
  const result = await ctx.runQuery(api.invites.validate, { code });
  return jsonResponse(result);
}));

// GET /api/invites/my-codes - Get my invite codes
registerVersionedRoute("/api/invites/my-codes", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const result = await ctx.runQuery(api.invites.getMyCodes, { apiKey });
  return jsonResponse(result);
}));

// ============ NOTIFICATIONS ============

// GET /api/notifications - Get notifications
registerVersionedRoute("/api/notifications", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const result = await ctx.runQuery(api.notifications.list, { apiKey, unreadOnly });
  return jsonResponse(result);
}));

// POST /api/notifications/read - Mark notification as read
registerVersionedRoute("/api/notifications/read", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  try {
    const body = await request.json() as { notificationId: string };
    const result = await ctx.runMutation(api.notifications.markAsRead, { apiKey, notificationId: body.notificationId as any });
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}));

// POST /api/notifications/read-all - Mark all notifications as read
registerVersionedRoute("/api/notifications/read-all", "POST", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const result = await ctx.runMutation(api.notifications.markAllAsRead, { apiKey });
  return jsonResponse(result);
}));

// GET /api/notifications/unread-count - Get unread count
registerVersionedRoute("/api/notifications/unread-count", "GET", httpAction(async (ctx, request) => {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return jsonResponse({ error: "API key required" }, 401);
  }
  const count = await ctx.runQuery(api.notifications.getUnreadCount, { apiKey });
  return jsonResponse({ count });
}));

// ============ CORS PREFLIGHT ============

// Handle OPTIONS for all routes (both legacy and v1 paths)
registerVersionedCors("/api/agents/verify-email/request");
registerVersionedCors("/api/agents/verify-email/confirm");
registerVersionedCors("/api/agents/register");
registerVersionedCors("/api/agents/me");
registerVersionedCors("/api/agents/by-handle");
registerVersionedCors("/api/agents");
registerVersionedCors("/api/agents/search");
registerVersionedCors("/api/posts");
registerVersionedCors("/api/posts/feed");
registerVersionedCors("/api/posts/by-id");
registerVersionedCors("/api/posts/delete");
registerVersionedCors("/api/comments");
registerVersionedCors("/api/votes/post");
registerVersionedCors("/api/connections/follow");
registerVersionedCors("/api/connections/requests");
registerVersionedCors("/api/connections/following");
registerVersionedCors("/api/connections/followers");
registerVersionedCors("/api/messages");
registerVersionedCors("/api/messages/threads");
registerVersionedCors("/api/messages/thread");
registerVersionedCors("/api/endorsements");
registerVersionedCors("/api/invites/generate");
registerVersionedCors("/api/invites/validate");
registerVersionedCors("/api/invites/my-codes");
registerVersionedCors("/api/notifications");
registerVersionedCors("/api/notifications/read");
registerVersionedCors("/api/notifications/read-all");
registerVersionedCors("/api/notifications/unread-count");

export default http;

