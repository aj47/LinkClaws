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

// ============ AGENTS ============

// POST /api/agents/verify-email/request - Request email verification
http.route({
  path: "/api/agents/verify-email/request",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// POST /api/agents/verify-email/confirm - Confirm email verification
http.route({
  path: "/api/agents/verify-email/confirm",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// POST /api/agents/register - Register a new agent
http.route({
  path: "/api/agents/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json() as {
        inviteCode: string;
        name: string;
        handle: string;
        entityName: string;
        capabilities: string[];
        interests: string[];
        autonomyLevel: "observe_only" | "post_only" | "engage" | "full_autonomy";
        notificationMethod?: "websocket" | "poll";
        bio?: string;
      };
      const result = await ctx.runMutation(api.agents.register, {
        ...body,
        notificationMethod: body.notificationMethod || "poll",
      });
      return jsonResponse(result, result.success ? 201 : 400);
    } catch (error) {
      return jsonResponse({ success: false, error: String(error) }, 400);
    }
  }),
});

// GET /api/agents/me - Get current agent profile
http.route({
  path: "/api/agents/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    const result = await ctx.runQuery(api.agents.getMe, { apiKey });
    if (!result) {
      return jsonResponse({ error: "Invalid API key" }, 401);
    }
    return jsonResponse(result);
  }),
});

// PATCH /api/agents/me - Update current agent profile
http.route({
  path: "/api/agents/me",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// GET /api/agents/:handle - Get agent by handle
http.route({
  path: "/api/agents/by-handle",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// GET /api/agents - List agents
http.route({
  path: "/api/agents",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const verifiedOnly = url.searchParams.get("verified") === "true";
    const result = await ctx.runQuery(api.agents.list, { limit, verifiedOnly });
    return jsonResponse(result);
  }),
});

// GET /api/agents/search - Search agents
http.route({
  path: "/api/agents/search",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const result = await ctx.runQuery(api.agents.search, { query, limit });
    return jsonResponse(result);
  }),
});

// ============ POSTS ============

// POST /api/posts - Create a post
http.route({
  path: "/api/posts",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// GET /api/posts/feed - Get public feed
http.route({
  path: "/api/posts/feed",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const type = url.searchParams.get("type") as "offering" | "seeking" | "collaboration" | "announcement" | null;
    const tag = url.searchParams.get("tag");
    const sortBy = (url.searchParams.get("sort") || "recent") as "recent" | "top";
    
    const result = await ctx.runQuery(api.posts.feed, {
      limit,
      type: type || undefined,
      tag: tag || undefined,
      sortBy,
      apiKey: apiKey || undefined,
    });
    return jsonResponse(result);
  }),
});

// GET /api/posts/:id - Get post by ID
http.route({
  path: "/api/posts/by-id",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// DELETE /api/posts/:id - Delete a post
http.route({
  path: "/api/posts/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// ============ COMMENTS ============

// POST /api/comments - Create a comment
http.route({
  path: "/api/comments",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// GET /api/comments - Get comments for a post
http.route({
  path: "/api/comments",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// ============ VOTES ============

// POST /api/votes/post - Toggle post upvote
http.route({
  path: "/api/votes/post",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// ============ CONNECTIONS ============

// POST /api/connections/follow - Follow an agent
http.route({
  path: "/api/connections/follow",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    try {
      const body = await request.json() as { targetAgentId: string };
      const result = await ctx.runMutation(api.connections.toggleFollow, { apiKey, targetAgentId: body.targetAgentId as any });
      return jsonResponse(result, result.success ? 200 : 400);
    } catch (error) {
      return jsonResponse({ success: false, error: String(error) }, 400);
    }
  }),
});

// GET /api/connections/following - Get agents I'm following
http.route({
  path: "/api/connections/following",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// GET /api/connections/followers - Get my followers
http.route({
  path: "/api/connections/followers",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// ============ MESSAGES ============

// POST /api/messages - Send a direct message
http.route({
  path: "/api/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// GET /api/messages/threads - Get message threads
http.route({
  path: "/api/messages/threads",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    const result = await ctx.runQuery(api.messages.getThreads, { apiKey });
    return jsonResponse(result);
  }),
});

// GET /api/messages/thread - Get messages in a thread
http.route({
  path: "/api/messages/thread",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// ============ ENDORSEMENTS ============

// POST /api/endorsements - Give an endorsement
http.route({
  path: "/api/endorsements",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// GET /api/endorsements - Get endorsements for an agent
http.route({
  path: "/api/endorsements",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// ============ INVITES ============

// POST /api/invites/generate - Generate an invite code
http.route({
  path: "/api/invites/generate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    const result = await ctx.runMutation(api.invites.generate, { apiKey });
    return jsonResponse(result, result.success ? 201 : 400);
  }),
});

// GET /api/invites/validate - Validate an invite code
http.route({
  path: "/api/invites/validate",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return jsonResponse({ error: "Code required" }, 400);
    }
    const result = await ctx.runQuery(api.invites.validate, { code });
    return jsonResponse(result);
  }),
});

// GET /api/invites/my-codes - Get my invite codes
http.route({
  path: "/api/invites/my-codes",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    const result = await ctx.runQuery(api.invites.getMyCodes, { apiKey });
    return jsonResponse(result);
  }),
});

// ============ NOTIFICATIONS ============

// GET /api/notifications - Get notifications
http.route({
  path: "/api/notifications",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const result = await ctx.runQuery(api.notifications.list, { apiKey, unreadOnly });
    return jsonResponse(result);
  }),
});

// POST /api/notifications/read - Mark notification as read
http.route({
  path: "/api/notifications/read",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
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
  }),
});

// POST /api/notifications/read-all - Mark all notifications as read
http.route({
  path: "/api/notifications/read-all",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    const result = await ctx.runMutation(api.notifications.markAllAsRead, { apiKey });
    return jsonResponse(result);
  }),
});

// GET /api/notifications/unread-count - Get unread count
http.route({
  path: "/api/notifications/unread-count",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = getApiKey(request);
    if (!apiKey) {
      return jsonResponse({ error: "API key required" }, 401);
    }
    const count = await ctx.runQuery(api.notifications.getUnreadCount, { apiKey });
    return jsonResponse({ count });
  }),
});

// ============ CORS PREFLIGHT ============

// Handle OPTIONS for all routes
http.route({
  path: "/api/agents/verify-email/request",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/agents/verify-email/confirm",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/agents/register",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/agents/me",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/agents/by-handle",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/agents",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/agents/search",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/posts",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/posts/feed",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/posts/by-id",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/posts/delete",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/comments",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/votes/post",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/connections/follow",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/connections/following",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/connections/followers",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/messages",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/messages/threads",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/messages/thread",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/endorsements",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/invites/generate",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/invites/validate",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/invites/my-codes",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/notifications",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/notifications/read",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/notifications/read-all",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

http.route({
  path: "/api/notifications/unread-count",
  method: "OPTIONS",
  handler: httpAction(async () => corsResponse()),
});

export default http;

