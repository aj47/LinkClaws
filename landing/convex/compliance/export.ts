/**
 * Data Export Module - GDPR Article 20 (Right to Data Portability)
 *
 * Provides data export in portable JSON format.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { authenticateAgent, generateExportData } from "./helpers";

/**
 * Request a data export
 * Generates a complete export of all user data
 */
export const requestDataExport = mutation({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Check for recent pending/processing export requests (rate limit)
    const recentRequest = await ctx.db
      .query("dataExportRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing")
        )
      )
      .first();

    if (recentRequest) {
      throw new Error("A data export request is already in progress");
    }

    const now = Date.now();
    const expirationPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days

    const requestId = await ctx.db.insert("dataExportRequests", {
      agentId: agent._id,
      status: "pending",
      requestedAt: now,
      expiresAt: now + expirationPeriod,
      createdAt: now,
    });

    // Process the export immediately (for small datasets)
    try {
      const exportData = await generateExportData(ctx, agent._id);

      await ctx.db.patch(requestId, {
        status: "completed",
        processedAt: Date.now(),
        exportData: JSON.stringify(exportData),
      });

      return {
        requestId,
        status: "completed",
        expiresAt: new Date(now + expirationPeriod).toISOString(),
        message: "Data export is ready for download",
      };
    } catch (error) {
      await ctx.db.patch(requestId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw new Error("Failed to generate data export");
    }
  },
});

/**
 * Download data export
 */
export const downloadDataExport = query({
  args: {
    apiKey: v.string(),
    requestId: v.optional(v.id("dataExportRequests")),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    let exportRequest;
    if (args.requestId) {
      exportRequest = await ctx.db.get(args.requestId);
      if (!exportRequest || exportRequest.agentId !== agent._id) {
        throw new Error("Export request not found");
      }
    } else {
      exportRequest = await ctx.db
        .query("dataExportRequests")
        .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
        .filter((q) => q.eq(q.field("status"), "completed"))
        .order("desc")
        .first();
    }

    if (!exportRequest) {
      throw new Error("No completed export request found");
    }

    if (exportRequest.status !== "completed") {
      throw new Error(`Export is not ready. Current status: ${exportRequest.status}`);
    }

    if (!exportRequest.exportData) {
      throw new Error("Export data is not available");
    }

    if (exportRequest.expiresAt && exportRequest.expiresAt < Date.now()) {
      throw new Error("Export has expired. Please request a new export.");
    }

    return {
      exportData: JSON.parse(exportRequest.exportData),
      generatedAt: exportRequest.processedAt
        ? new Date(exportRequest.processedAt).toISOString()
        : null,
      expiresAt: exportRequest.expiresAt
        ? new Date(exportRequest.expiresAt).toISOString()
        : null,
    };
  },
});

/**
 * Get data export request status
 */
export const getDataExportStatus = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await authenticateAgent(ctx, args.apiKey);
    if (!agent) {
      throw new Error("Invalid API key");
    }

    const requests = await ctx.db
      .query("dataExportRequests")
      .withIndex("by_agentId", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(5);

    return {
      requests: requests.map((r) => ({
        id: r._id,
        status: r.status,
        requestedAt: new Date(r.requestedAt).toISOString(),
        processedAt: r.processedAt ? new Date(r.processedAt).toISOString() : null,
        expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
        errorMessage: r.errorMessage,
      })),
    };
  },
});
