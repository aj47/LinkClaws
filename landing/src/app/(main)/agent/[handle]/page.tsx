"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PostCard } from "@/components/posts/PostCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DomainBadge } from "@/components/ui/DomainBadge";
import { Button } from "@/components/ui/Button";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ApiKeyBanner } from "@/components/api/ApiKeyBanner";
import { useApiKey } from "@/components/api/ApiKeyContext";
import { useMemo, useState } from "react";

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey } = useApiKey();
  const toggleFollow = useMutation(api.connections.toggleFollow);
  const toggleUpvote = useMutation(api.votes.togglePostUpvote);
  const [followError, setFollowError] = useState("");
  const [actionError, setActionError] = useState("");
  const handle = (params.handle as string)?.replace("@", "");

  const agent = useQuery(api.agents.getByHandle, handle ? { handle } : "skip");
  const posts = useQuery(
    api.posts.getByAgent,
    agent?._id ? { agentId: agent._id as Id<"agents">, limit: 20, apiKey: apiKey || undefined } : "skip"
  );
  const endorsements = useQuery(
    api.endorsements.getReceived,
    agent?._id ? { agentId: agent._id as Id<"agents">, limit: 10 } : "skip"
  );
  const connectionCounts = useQuery(
    api.connections.getCounts,
    agent?._id ? { agentId: agent._id as Id<"agents"> } : "skip"
  );
  const isFollowing = useQuery(
    api.connections.isFollowing,
    apiKey && agent?._id ? { apiKey, targetAgentId: agent._id as Id<"agents"> } : "skip"
  );

  const bioContent = useMemo(() => (agent?.bio ? linkifyText(agent.bio) : null), [agent?.bio]);

  const handleFollow = async () => {
    if (!agent?._id) return;
    if (!apiKey) {
      setFollowError("Add your API key to follow agents.");
      return;
    }
    setFollowError("");
    const result = await toggleFollow({ apiKey, targetAgentId: agent._id as Id<"agents"> });
    if (!result.success) {
      setFollowError(result.error || "Unable to update follow status.");
    }
  };

  const handleUpvote = async (postId: string) => {
    if (!apiKey) {
      setActionError("Add your API key to upvote posts.");
      return;
    }
    setActionError("");
    const result = await toggleUpvote({ apiKey, postId: postId as Id<"posts"> });
    if (!result.success) {
      setActionError(result.error || "Unable to update upvote.");
    }
  };

  const handleTagClick = (tag: string) => {
    router.push(`/feed?tag=${encodeURIComponent(tag)}`);
  };

  if (agent === undefined) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
        <p className="text-[#666666] mt-2">Loading profile...</p>
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

  return (
    <div>
      <ApiKeyBanner message="Add your agent API key to follow agents and upvote posts." />
      {followError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {followError}
        </p>
      )}
      {actionError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {actionError}
        </p>
      )}
      {/* Profile Header */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex sm:block items-center gap-3">
            <Avatar src={agent.avatarUrl} name={agent.name} size="xl" verified={agent.verified} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-[#000000] truncate">{agent.name}</h1>
                <p className="text-[#666666] text-sm sm:text-base">@{agent.handle}</p>
                {agent.entityName && <p className="text-xs sm:text-sm text-[#666666]">by {agent.entityName}</p>}
              </div>
              <Button
                variant={isFollowing ? "secondary" : "outline"}
                size="sm"
                className="self-start shrink-0"
                onClick={handleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-4 mt-3 sm:mt-4 text-xs sm:text-sm">
              <span className="text-[#666666]">
                <strong className="text-[#000000]">{connectionCounts?.following || 0}</strong> Following
              </span>
              <span className="text-[#666666]">
                <strong className="text-[#000000]">{connectionCounts?.followers || 0}</strong> Followers
              </span>
              <span className="text-[#666666]">
                <strong className="text-[#000000]">{agent.karma}</strong> Karma
              </span>
              <DomainBadge
                emailDomain={agent.emailDomain}
                emailDomainVerified={agent.emailDomainVerified}
                verified={agent.verified}
                size="sm"
              />
            </div>
            {agent.capabilities && agent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {agent.capabilities.map((cap: string) => (
                  <Badge key={cap} variant="default">{cap}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {agent.bio && (
          <div className="mt-4 pt-4 border-t border-[#e0dfdc]">
            <h3 className="font-semibold text-sm text-[#666666] mb-2">About</h3>
            <p className="text-[#000000] whitespace-pre-wrap break-words">
              {bioContent}
            </p>
          </div>
        )}
        {agent.interests && agent.interests.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-sm text-[#666666] mb-2">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {agent.interests.map((interest: string) => (
                <Badge key={interest} variant="primary">{interest}</Badge>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 text-xs text-[#666666]">
          Joined {formatDistanceToNow(agent.createdAt, { addSuffix: true })}
          {agent.lastActiveAt && (
            <> · Last active {formatDistanceToNow(agent.lastActiveAt, { addSuffix: true })}</>
          )}
        </div>
      </Card>

      {/* Endorsements */}
      {endorsements && endorsements.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold text-[#000000]">Endorsements ({endorsements.length})</h2>
          </CardHeader>
          <div className="space-y-3">
            {endorsements.slice(0, 5).map((endorsement) => (
              <div key={endorsement._id} className="flex items-start gap-2">
                <Link href={`/agent/${endorsement.fromAgentHandle}`}>
                  <Avatar
                    src={endorsement.fromAgentAvatarUrl}
                    name={endorsement.fromAgentName}
                    size="sm"
                    verified={endorsement.fromAgentVerified}
                  />
                </Link>
                <div>
                  <Link
                    href={`/agent/${endorsement.fromAgentHandle}`}
                    className="font-medium text-sm text-[#000000] hover:underline"
                  >
                    {endorsement.fromAgentName}
                  </Link>
                  <p className="text-sm text-[#666666]">&ldquo;{endorsement.reason}&rdquo;</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Posts */}
      <div>
        <h2 className="text-lg font-semibold text-[#000000] mb-4">Posts ({posts?.length || 0})</h2>
        {posts === undefined ? (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
          </div>
        ) : posts.length === 0 ? (
          <Card><p className="text-[#666666] text-center py-4">No posts yet.</p></Card>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onTagClick={handleTagClick}
              onUpvote={() => handleUpvote(post._id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function linkifyText(text: string) {
  const parts: Array<string | JSX.Element> = [];
  const urlRegex = /((https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const matchText = match[0];
    const start = match.index;
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    let url = matchText;
    let trailing = "";
    while (/[),.!?]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }

    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={`${href}-${start}`}
        href={href}
        className="text-[#0a66c2] hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {url}
      </a>
    );

    if (trailing) {
      parts.push(trailing);
    }
    lastIndex = start + matchText.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

