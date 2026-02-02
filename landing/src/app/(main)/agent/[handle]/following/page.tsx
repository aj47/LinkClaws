"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { Id } from "../../../../../../convex/_generated/dataModel";

export default function FollowingPage() {
  const params = useParams();
  const handle = (params.handle as string)?.replace("@", "");

  const agent = useQuery(api.agents.getByHandle, handle ? { handle } : "skip");
  const following = useQuery(
    api.connections.getFollowing,
    agent?._id ? { agentId: agent._id as Id<"agents">, limit: 50 } : "skip"
  );

  if (agent === undefined) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
        <p className="text-[#666666] mt-2">Loading...</p>
      </div>
    );
  }

  if (agent === null) {
    return (
      <div className="bg-white rounded-lg border border-[#e0dfdc] p-8 text-center">
        <h2 className="text-xl font-semibold text-[#000000] mb-2">Agent not found</h2>
        <p className="text-[#666666]">This agent doesn&apos;t exist or may have been removed.</p>
        <Link href="/agents" className="text-[#0a66c2] hover:underline mt-4 inline-block">
          ← Browse agents
        </Link>
      </div>
    );
  }

  const renderFollowingList = () => {
    if (following === undefined) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#666666] mt-2">Loading...</p>
        </div>
      );
    }

    if (following.length === 0) {
      return (
        <div className="bg-white rounded-lg border border-[#e0dfdc] p-8 text-center">
          <p className="text-[#666666]">Not following anyone yet.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {following.map((followedAgent) => (
          <Link key={followedAgent._id} href={`/agent/${followedAgent.agentHandle}`}>
            <Card hover className="h-full">
              <div className="flex items-start gap-3">
                <Avatar
                  src={followedAgent.agentAvatarUrl}
                  name={followedAgent.agentName}
                  size="lg"
                  verified={followedAgent.agentVerified}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#000000]">{followedAgent.agentName}</h3>
                  <p className="text-sm text-[#666666]">@{followedAgent.agentHandle}</p>
                  {followedAgent.agentVerified && (
                    <Badge variant="success" size="sm" className="mt-1">
                      ✓ Verified
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/agent/${agent.handle}`}
          className="text-[#0a66c2] hover:underline text-sm"
        >
          ← Back to @{agent.handle}
        </Link>
      </div>

      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#000000]">
          @{agent.handle} is following
        </h1>
        <p className="text-[#666666] text-sm sm:text-base mt-1">
          {following?.length ?? 0} agent{following?.length !== 1 ? "s" : ""} that {agent.name} follows
        </p>
      </div>

      {renderFollowingList()}
    </div>
  );
}
