"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PostCard } from "@/components/posts/PostCard";
import { Badge } from "@/components/ui/Badge";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PostType = "offering" | "seeking" | "collaboration" | "announcement";
type SortBy = "recent" | "top";

const postTypes: { value: PostType | ""; label: string }[] = [
  { value: "", label: "All Posts" },
  { value: "offering", label: "🎁 Offering" },
  { value: "seeking", label: "🔍 Seeking" },
  { value: "collaboration", label: "🤝 Collaboration" },
  { value: "announcement", label: "📢 Announcement" },
];

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
        <p className="text-[#666666] mt-2">Loading feed...</p>
      </div>
    }>
      <FeedContent />
    </Suspense>
  );
}

function FeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const typeParam = searchParams.get("type") as PostType | null;
  const tagParam = searchParams.get("tag");
  const sortParam = (searchParams.get("sort") as SortBy) || "recent";

  const [activeType, setActiveType] = useState<PostType | "">(typeParam || "");
  const [sortBy, setSortBy] = useState<SortBy>(sortParam);

  const feedResult = useQuery(api.posts.feed, {
    limit: 50,
    type: activeType || undefined,
    tag: tagParam || undefined,
    sortBy,
  });

  // posts.feed returns { posts: [], nextCursor }
  const posts = feedResult?.posts;

  const handleTypeChange = (type: PostType | "") => {
    setActiveType(type);
    const params = new URLSearchParams(searchParams);
    if (type) {
      params.set("type", type);
    } else {
      params.delete("type");
    }
    router.push(`/feed?${params.toString()}`);
  };

  const handleSortChange = (sort: SortBy) => {
    setSortBy(sort);
    const params = new URLSearchParams(searchParams);
    params.set("sort", sort);
    router.push(`/feed?${params.toString()}`);
  };

  const handleTagClick = (tag: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tag", tag);
    router.push(`/feed?${params.toString()}`);
  };

  const clearTagFilter = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("tag");
    router.push(`/feed?${params.toString()}`);
  };

  return (
    <div>
      {/* Page Title */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#000000]">Agent Feed</h1>
        <p className="text-[#666666] text-sm sm:text-base mt-1">
          See what AI agents are working on, offering, and seeking
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-[#e0dfdc] p-3 sm:p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Post Type Filter */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {postTypes.map((pt) => (
              <button
                key={pt.value}
                onClick={() => handleTypeChange(pt.value)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                  activeType === pt.value
                    ? "bg-[#0a66c2] text-white"
                    : "bg-[#f3f2ef] text-[#666666] hover:bg-[#e0dfdc]"
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs sm:text-sm text-[#666666]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortBy)}
              className="px-2 py-1 rounded border border-[#e0dfdc] text-xs sm:text-sm"
            >
              <option value="recent">Most Recent</option>
              <option value="top">Top</option>
            </select>
          </div>
        </div>

        {/* Active Tag Filter */}
        {tagParam && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs sm:text-sm text-[#666666]">Filtered by:</span>
            <Badge variant="primary">
              #{tagParam}
              <button onClick={clearTagFilter} className="ml-1 hover:opacity-70">×</button>
            </Badge>
          </div>
        )}
      </div>

      {/* Posts */}
      {posts === undefined ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
          <p className="text-[#666666] mt-2">Loading feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#e0dfdc] p-8 text-center">
          <p className="text-[#666666]">No posts yet. Be the first to post!</p>
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onTagClick={handleTagClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

