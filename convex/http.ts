import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { getApiKey, getAgentByApiKey } from "./lib/auth";

// ============================================
// HTTP Router Setup
// ============================================

const http = httpRouter();

// ============================================
// CORS Helper Functions
// ============================================

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

// ============================================
// Authentication Helper
// ============================================

async function authenticateRequest(ctx: any, request: Request) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return { authenticated: false, error: "Missing API key" };
  }

  const agent = await getAgentByApiKey(ctx, apiKey);
  if (!agent) {
    return { authenticated: false, error: "Invalid API key" };
  }

  return { authenticated: true, agent };
}

// ============================================
// Deal Endpoints
// ============================================

// POST /api/deals/propose
http.route({
  path: "/api/deals/propose",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:proposeDeal", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deals/counter
http.route({
  path: "/api/deals/counter",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:counterDeal", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deals/accept
http.route({
  path: "/api/deals/accept",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:acceptDeal", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deals/reject
http.route({
  path: "/api/deals/reject",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:rejectDeal", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deals/cancel
http.route({
  path: "/api/deals/cancel",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:cancelDeal", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deals/complete
http.route({
  path: "/api/deals/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:completeDeal", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deals/request-approval
http.route({
  path: "/api/deals/request-approval",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:requestHumanApproval", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deals/human-decision
http.route({
  path: "/api/deals/human-decision",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Authenticate request - human decisions require admin privileges
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    // Verify admin privileges (owner role required for human decisions)
    if (auth.agent?.role !== "owner") {
      return errorResponse("Admin privileges required", 403);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.deals:humanDecision", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/deals/:id
http.route({
  path: "/api/deals/:id",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const dealId = url.pathname.split("/").pop()!;
      const result = await ctx.runQuery("api.deals:getById", { dealId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/deals
http.route({
  path: "/api/deals",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") as any;
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const result = await ctx.runQuery("api.deals:listMyDeals", { status, limit });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/deals/pending-approvals
http.route({
  path: "/api/deals/pending-approvals",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const result = await ctx.runQuery("api.deals:getPendingApprovals", { limit });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// ============================================
// Match Endpoints
// ============================================

// GET /api/matches/suggested
http.route({
  path: "/api/matches/suggested",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const minScore = parseInt(url.searchParams.get("minScore") || "50");
      const result = await ctx.runQuery("api.matches:getSuggestedMatches", { limit, minScore });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/matches/:id
http.route({
  path: "/api/matches/:id",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const matchId = url.pathname.split("/").pop()!;
      const result = await ctx.runQuery("api.matches:getById", { matchId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/matches/history
http.route({
  path: "/api/matches/history",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const status = url.searchParams.get("status") as any;
      const result = await ctx.runQuery("api.matches:getMatchHistory", { limit, status });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/matches/find
http.route({
  path: "/api/matches/find",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.matches:findMatches", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/matches/viewed
http.route({
  path: "/api/matches/viewed",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.matches:markAsViewed", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/matches/dismiss
http.route({
  path: "/api/matches/dismiss",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.matches:dismissMatch", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/matches/calculate
http.route({
  path: "/api/matches/calculate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.matches:calculateMatch", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// ============================================
// Offering Endpoints
// ============================================

// POST /api/offerings
http.route({
  path: "/api/offerings",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.offerings:create", body);
      return jsonResponse({ success: true, data: result }, 201);
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/offerings
http.route({
  path: "/api/offerings",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get("q") || undefined;
      const category = url.searchParams.get("category") || undefined;
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const onlyActive = url.searchParams.get("onlyActive") !== "false";

      const result = await ctx.runQuery("api.offerings:search", {
        query: query || undefined,
        category: category || undefined,
        limit,
        onlyActive,
      });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/offerings/my
http.route({
  path: "/api/offerings/my",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const result = await ctx.runQuery("api.offerings:getMyOfferings", {});
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/offerings/by-agent/:agentId
http.route({
  path: "/api/offerings/by-agent/:agentId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const agentId = url.pathname.split("/").pop()!;
      const onlyActive = url.searchParams.get("onlyActive") !== "false";

      const result = await ctx.runQuery("api.offerings:getByAgent", {
        agentId: agentId as any,
        onlyActive,
      });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/offerings/:id
http.route({
  path: "/api/offerings/:id",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const offeringId = url.pathname.split("/").pop()!;
      const result = await ctx.runQuery("api.offerings:getById", { offeringId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// PATCH /api/offerings/:id
http.route({
  path: "/api/offerings/:id",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const offeringId = url.pathname.split("/").pop()!;
      const body = await request.json();
      const result = await ctx.runMutation("api.offerings:update", {
        offeringId,
        ...body,
      });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// DELETE /api/offerings/:id
http.route({
  path: "/api/offerings/:id",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const offeringId = url.pathname.split("/").pop()!;
      const result = await ctx.runMutation("api.offerings:remove", { offeringId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/offerings/:id/deactivate
http.route({
  path: "/api/offerings/:id/deactivate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const offeringId = url.pathname.split("/").pop()!;
      const result = await ctx.runMutation("api.offerings:deactivate", { offeringId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/offerings/categories
http.route({
  path: "/api/offerings/categories",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const result = await ctx.runQuery("api.offerings:getCategories", {});
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// ============================================
// Need Endpoints
// ============================================

// POST /api/needs
http.route({
  path: "/api/needs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.needs:create", body);
      return jsonResponse({ success: true, data: result }, 201);
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/needs
http.route({
  path: "/api/needs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get("q") || undefined;
      const category = url.searchParams.get("category") || undefined;
      const urgency = url.searchParams.get("urgency") as any;
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const onlyActive = url.searchParams.get("onlyActive") !== "false";

      const result = await ctx.runQuery("api.needs:search", {
        query: query || undefined,
        category: category || undefined,
        urgency,
        limit,
        onlyActive,
      });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/needs/urgent
http.route({
  path: "/api/needs/urgent",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const result = await ctx.runQuery("api.needs:getUrgentNeeds", { limit });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/needs/my
http.route({
  path: "/api/needs/my",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const result = await ctx.runQuery("api.needs:getMyNeeds", {});
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/needs/by-agent/:agentId
http.route({
  path: "/api/needs/by-agent/:agentId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const agentId = url.pathname.split("/").pop()!;
      const onlyActive = url.searchParams.get("onlyActive") !== "false";

      const result = await ctx.runQuery("api.needs:getByAgent", {
        agentId: agentId as any,
        onlyActive,
      });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// GET /api/needs/:id
http.route({
  path: "/api/needs/:id",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const needId = url.pathname.split("/").pop()!;
      const result = await ctx.runQuery("api.needs:getById", { needId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// PATCH /api/needs/:id
http.route({
  path: "/api/needs/:id",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const needId = url.pathname.split("/").pop()!;
      const body = await request.json();
      const result = await ctx.runMutation("api.needs:update", {
        needId,
        ...body,
      });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// DELETE /api/needs/:id
http.route({
  path: "/api/needs/:id",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const needId = url.pathname.split("/").pop()!;
      const result = await ctx.runMutation("api.needs:remove", { needId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/needs/:id/fulfill
http.route({
  path: "/api/needs/:id/fulfill",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const url = new URL(request.url);
      const needId = url.pathname.split("/").pop()!;
      const result = await ctx.runMutation("api.needs:markFulfilled", { needId });
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// ============================================
// Deal Parameters Endpoints
// ============================================

// GET /api/deal-parameters
http.route({
  path: "/api/deal-parameters",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const result = await ctx.runQuery("api.dealParameters:getMyDealParameters", {});
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// POST /api/deal-parameters
http.route({
  path: "/api/deal-parameters",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.dealParameters:upsert", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// PATCH /api/deal-parameters
http.route({
  path: "/api/deal-parameters",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (!auth.authenticated) {
      return errorResponse(auth.error!, 401);
    }

    try {
      const body = await request.json();
      const result = await ctx.runMutation("api.dealParameters:update", body);
      return jsonResponse({ success: true, data: result });
    } catch (error: any) {
      return errorResponse(error.message);
    }
  }),
});

// ============================================
// CORS Preflight
// ============================================

// Handle OPTIONS requests for all paths
http.route({
  path: "/api/*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

http.route({
  path: "/api/*/*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

http.route({
  path: "/api/*/*/*",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// Export the router
export default http;
