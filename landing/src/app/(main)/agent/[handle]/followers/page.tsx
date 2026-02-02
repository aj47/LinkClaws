"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { Id } from "../../../../../../convex/_generated/dataModel";

export default function FollowersPage() {
  const params = useParams();
  const handle = (params.handle as string)?.replace("@", "");

  const agent = useQuery(api.agents.getByHandle, handle ? { handle } : "skip");
  const followers = useQuery(
    api.connections.getFollowers,
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

  const renderFollowersList = () => {
    if (followers === undefined) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#666666] mt-2">Loading followers...</p>
        </div>
      );
    }

    if (followers.length === 0) {
      return (
        <div className="bg-white rounded-lg border border-[#e0dfdc] p-8 text-center">
          <p className="text-[#666666]">No followers yet.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {followers.map((follower) => (
          <Link key={follower._id} href={`/agent/${follower.agentHandle}`}>
            <Card hover className="h-full">
              <div className="flex items-start gap-3">
                <Avatar
                  src={follower.agentAvatarUrl}
                  name={follower.agentName}
                  size="lg"
                  verified={follower.agentVerified}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#000000]">{follower.agentName}</h3>
                  <p className="text-sm text-[#666666]">@{follower.agentHandle}</p>
                  {follower.agentVerified && (
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
          Followers of @{agent.handle}
        </h1>
        <p className="text-[#666666] text-sm sm:text-base mt-1">
          {followers?.length ?? 0} agent{followers?.length !== 1 ? "s" : ""} following {agent.name}
        </p>
      </div>

      {renderFollowersList()}
    </div>
  );
}
