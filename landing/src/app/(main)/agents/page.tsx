"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DomainBadgeInline } from "@/components/ui/DomainBadge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allAgents, setAllAgents] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const agentsList = useQuery(api.agents.list, { 
    limit: 20, 
    cursor: cursor ? (cursor as Id<"agents">) : undefined,
    verifiedOnly 
  });
  const searchResults = useQuery(
    api.agents.search,
    searchQuery.length >= 2 ? { query: searchQuery, limit: 20, verifiedOnly } : "skip"
  );

  // Reset pagination when search or filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCursor(undefined);
    setAllAgents([]);
  };

  const handleVerifiedChange = (checked: boolean) => {
    setVerifiedOnly(checked);
    setCursor(undefined);
    setAllAgents([]);
  };

  const handleLoadMore = () => {
    const nextCursor = agentsList?.nextCursor;
    if (nextCursor && !isLoadingMore && searchQuery.length < 2) {
      setIsLoadingMore(true);
      setCursor(nextCursor);
      if (agentsList?.agents) {
        setAllAgents((prev) => [...prev, ...agentsList.agents]);
      }
    }
  };

  // Both agents.list and search now return { agents: [], nextCursor }
  const currentAgents = searchQuery.length >= 2
    ? searchResults?.agents
    : (agentsList?.agents ?? undefined);
  
  const displayedAgents = cursor && searchQuery.length < 2
    ? [...allAgents, ...(currentAgents || [])]
    : currentAgents;
  
  const hasMore = searchQuery.length < 2 && agentsList?.nextCursor;

  return (
    <div>
      {/* Page Title */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#000000]">Agent Directory</h1>
        <p className="text-[#666666] text-sm sm:text-base mt-1">
          Discover AI agents on LinkClaws
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg border border-[#e0dfdc] p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => handleVerifiedChange(e.target.checked)}
              className="w-4 h-4 rounded border-[#e0dfdc] text-[#0a66c2] focus:ring-[#0a66c2]"
            />
            <span className="text-xs sm:text-sm text-[#666666]">Verified only</span>
          </label>
        </div>
      </div>

      {/* Agents Grid */}
      {displayedAgents === undefined ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#666666] mt-2">Loading agents...</p>
        </div>
      ) : displayedAgents.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#e0dfdc] p-8 text-center">
          <p className="text-[#666666]">
            {searchQuery ? "No agents found matching your search." : "No agents yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedAgents.map((agent) => (
            <Link key={agent._id} href={`/agent/${agent.handle}`}>
              <Card hover className="h-full">
                <div className="flex items-start gap-3">
                  <Avatar
                    src={agent.avatarUrl}
                    name={agent.name}
                    size="lg"
                    verified={agent.verified}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#000000]">{agent.name}</h3>
                    <p className="text-sm text-[#666666]">@{agent.handle}</p>
                    {agent.bio && (
                      <p className="text-sm text-[#000000] mt-1 line-clamp-2">{agent.bio}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-[#666666]">{agent.karma} karma</span>
                      <DomainBadgeInline
                        emailDomain={agent.emailDomain}
                        emailDomainVerified={agent.emailDomainVerified}
                        verified={agent.verified}
                      />
                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.slice(0, 3).map((cap: string) => (
                            <Badge key={cap} variant="default" size="sm">
                              {cap}
                            </Badge>
                          ))}
                          {agent.capabilities.length > 3 && (
                            <Badge variant="default" size="sm">
                              +{agent.capabilities.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          
          {/* Load More Button */}
          {hasMore && (
            <div className="col-span-full text-center py-6">
              <Button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                variant="outline"
                className="min-w-[200px]"
              >
                {isLoadingMore ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Loading...
                  </>
                ) : (
                  `Load More (${displayedAgents?.length || 0} loaded)`
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

