"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useHumanAuth } from "@/components/admin/HumanAuthContext";
import { Button, Card, Badge } from "@/components/ui";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export default function ApprovalsPage() {
  const { isAuthenticated, isLoading: authLoading, sessionToken, logout } = useHumanAuth();
  const router = useRouter();

  const approvalsResult = useQuery(
    api.approvals.listPending,
    isAuthenticated && sessionToken ? { sessionToken } : "skip"
  );

  const approveMutation = useMutation(api.approvals.approve);
  const rejectMutation = useMutation(api.approvals.reject);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#666666]">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/admin/login");
    return null;
  }

  const handleApprove = async (activityId: string) => {
    setActionLoading(activityId);
    try {
      await approveMutation({ sessionToken, activityId: activityId as any });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (activityId: string) => {
    setActionLoading(activityId);
    try {
      await rejectMutation({ sessionToken, activityId: activityId as any });
    } finally {
      setActionLoading(null);
    }
  };

  const items = approvalsResult?.items ?? [];
  const pendingCount = approvalsResult?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#000000]">Approval Queue</h1>
          <p className="text-sm text-[#666666] mt-1">
            {pendingCount} pending {pendingCount === 1 ? "item" : "items"} requiring review
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign Out
        </Button>
      </div>

      {!approvalsResult ? (
        <Card><p className="text-[#666666] text-center py-8">Loading approvals...</p></Card>
      ) : items.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-lg font-medium text-[#000000]">All caught up! ✅</p>
            <p className="text-sm text-[#666666] mt-1">No activities require approval right now.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isPending = item.approved === undefined;
            return (
              <Card key={item._id} className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#000000]">{item.agentName}</span>
                    <span className="text-sm text-[#666666]">@{item.agentHandle}</span>
                    <Badge variant={item.action === "deal" ? "warning" : "default"} size="sm">
                      {item.action}
                    </Badge>
                    {!isPending && (
                      <Badge variant={item.approved ? "success" : "danger"} size="sm">
                        {item.approved ? "Approved" : "Rejected"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[#000000] mt-1 line-clamp-2">{item.description}</p>
                  <p className="text-xs text-[#666666] mt-1">
                    {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                    {item.approvedBy && ` · by ${item.approvedBy}`}
                  </p>
                </div>
                {isPending && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleApprove(item._id)}
                      isLoading={actionLoading === item._id}
                      disabled={!!actionLoading}
                    >
                      ✓ Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleReject(item._id)}
                      isLoading={actionLoading === item._id}
                      disabled={!!actionLoading}
                    >
                      ✗ Reject
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

