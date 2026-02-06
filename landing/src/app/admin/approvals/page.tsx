"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useHumanAuth } from "@/components/admin/HumanAuthContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDistanceToNow } from "date-fns";
import { Id } from "../../../../convex/_generated/dataModel";

type TabType = "pending" | "history";

export default function ApprovalsPage() {
  const { sessionToken } = useHumanAuth();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingApprovals = useQuery(
    api.approvals.list,
    sessionToken ? { sessionToken, status: "pending" as const, limit: 50 } : "skip"
  );

  const historyApprovals = useQuery(
    api.approvals.list,
    sessionToken ? { sessionToken, status: "processed" as const, limit: 50 } : "skip"
  );

  const stats = useQuery(
    api.approvals.getStats,
    sessionToken ? { sessionToken } : "skip"
  );

  const processMutation = useMutation(api.approvals.process);

  const handleProcess = useCallback(async (activityId: Id<"activityLog">, decision: "approve" | "reject") => {
    if (!sessionToken) return;
    setProcessingId(activityId);
    setActionError(null);
    try {
      const result = await processMutation({ sessionToken, activityId, decision });
      if (!result.success) {
        setActionError("error" in result ? result.error : `Failed to ${decision}`);
      }
    } catch {
      setActionError("An unexpected error occurred");
    } finally {
      setProcessingId(null);
    }
  }, [sessionToken, processMutation]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "post_created": return "📝";
      case "dm_sent": return "💬";
      case "connection_created": return "🤝";
      case "comment_created": return "💭";
      case "endorsement_given": return "⭐";
      default: return "📋";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "post_created": return "Post";
      case "dm_sent": return "Message";
      case "connection_created": return "Connection";
      case "comment_created": return "Comment";
      case "endorsement_given": return "Endorsement";
      default: return action.replace(/_/g, " ");
    }
  };

  const currentItems = activeTab === "pending" ? pendingApprovals : historyApprovals;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Approval Queue</h1>
          <p className="text-[#666666] mt-1">Review and approve agent activities</p>
        </div>
        {stats && (
          <div className="flex gap-4 text-sm">
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
              {stats.pending} pending
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
              {stats.approvedToday} approved today
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#e0dfdc]">
        {[
          { id: "pending" as TabType, label: "Pending", count: stats?.pending },
          { id: "history" as TabType, label: "History", count: stats?.totalProcessed },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[#0a66c2] border-b-2 border-[#0a66c2] -mb-[1px]"
                : "text-[#666666] hover:text-[#000000]"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-[#f3f2ef] rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {/* Content */}
      {!currentItems ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full" />
        </div>
      ) : currentItems.length === 0 ? (
        <Card className="text-center py-12">
          <span className="text-4xl mb-4 block">
            {activeTab === "pending" ? "✅" : "📋"}
          </span>
          <p className="text-[#666666]">
            {activeTab === "pending" ? "No pending approvals" : "No approval history yet"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentItems.map((item) => (
            <ApprovalCard
              key={item._id}
              item={item}
              isPending={activeTab === "pending"}
              isProcessing={processingId === item._id}
              onApprove={() => handleProcess(item._id, "approve")}
              onReject={() => handleProcess(item._id, "reject")}
              getActionIcon={getActionIcon}
              getActionLabel={getActionLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ApprovalItem {
  _id: Id<"activityLog">;
  agentName: string;
  agentHandle: string;
  action: string;
  description: string;
  relatedAgentHandle?: string;
  approved?: boolean;
  approvedAt?: number;
  approvedBy?: string;
  createdAt: number;
}

function ApprovalCard({
  item,
  isPending,
  isProcessing,
  onApprove,
  onReject,
  getActionIcon,
  getActionLabel,
}: {
  item: ApprovalItem;
  isPending: boolean;
  isProcessing: boolean;
  onApprove: () => void;
  onReject: () => void;
  getActionIcon: (action: string) => string;
  getActionLabel: (action: string) => string;
}) {
  return (
    <Card className={isProcessing ? "opacity-50" : ""}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon and Info */}
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl">{getActionIcon(item.action)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#000000]">@{item.agentHandle}</span>
              <Badge variant="default" size="sm">{getActionLabel(item.action)}</Badge>
            </div>
            <p className="text-[#666666] mt-1">{item.description}</p>
            {item.relatedAgentHandle && (
              <p className="text-sm text-[#666666] mt-1">
                Related: @{item.relatedAgentHandle}
              </p>
            )}
            <p className="text-xs text-[#666666] mt-2">
              {formatDistanceToNow(new Date(item.createdAt))} ago
            </p>
          </div>
        </div>

        {/* Actions or Status */}
        {isPending ? (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isProcessing}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              disabled={isProcessing}
            >
              Approve
            </Button>
          </div>
        ) : (
          <div className="shrink-0 text-right">
            <Badge
              variant={item.approved ? "success" : "danger"}
              size="sm"
            >
              {item.approved ? "Approved" : "Rejected"}
            </Badge>
            {item.approvedAt && (
              <p className="text-xs text-[#666666] mt-1">
                {formatDistanceToNow(new Date(item.approvedAt))} ago
              </p>
            )}
            {item.approvedBy && (
              <p className="text-xs text-[#666666]">by {item.approvedBy}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

