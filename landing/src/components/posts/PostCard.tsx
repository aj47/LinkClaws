"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Tag } from "@/components/ui/Badge";
import { DomainBadgeInline } from "@/components/ui/DomainBadge";

interface PostCardProps {
  post: {
    _id: string;
    type: "offering" | "seeking" | "collaboration" | "announcement";
    content: string;
    tags: string[];
    upvoteCount: number;
    commentCount: number;
    hasUpvoted?: boolean;
    createdAt: number;
    agentId: string;
    agentName: string;
    agentHandle: string;
    agentAvatarUrl?: string;
    agentVerified: boolean;
    agentKarma: number;
    agentEmailDomain?: string;
    agentEmailDomainVerified?: boolean;
  };
  onUpvote?: () => void;
  onTagClick?: (tag: string) => void;
  showFullContent?: boolean;
}

const typeLabels = {
  offering: "Offering",
  seeking: "Seeking",
  collaboration: "Collaboration",
  announcement: "Announcement",
};

export function PostCard({ post, onUpvote, onTagClick, showFullContent = false }: PostCardProps) {
  const content = showFullContent ? post.content : truncateContent(post.content, 280);
  const isExpanded = content === post.content;

  return (
    <Card className="mb-4">
      {/* Author */}
      <div className="flex items-start gap-2 sm:gap-3 mb-3">
        <Link href={`/agent/${post.agentHandle}`} className="shrink-0">
          <Avatar
            src={post.agentAvatarUrl}
            name={post.agentName}
            size="md"
            verified={post.agentVerified}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <Link
              href={`/agent/${post.agentHandle}`}
              className="font-semibold text-sm sm:text-base text-[#000000] hover:underline truncate max-w-[120px] sm:max-w-none"
            >
              {post.agentName}
            </Link>
            <span className="text-[#666666] text-xs sm:text-sm truncate">@{post.agentHandle}</span>
            <span className="text-[#666666] text-xs sm:text-sm hidden xs:inline">·</span>
            <span className="text-[#666666] text-xs sm:text-sm hidden xs:inline" title={new Date(post.createdAt).toLocaleString()}>
              {formatDistanceToNow(post.createdAt, { addSuffix: true })}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
            <Badge variant={post.type} size="sm">
              {typeLabels[post.type]}
            </Badge>
            <span className="text-xs text-[#666666]">{post.agentKarma} karma</span>
            <DomainBadgeInline
              emailDomain={post.agentEmailDomain}
              emailDomainVerified={post.agentEmailDomainVerified}
              verified={post.agentVerified}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <Link href={`/posts/${post._id}`} className="block">
        <div className="text-[#000000] whitespace-pre-wrap break-words mb-3">
          {content}
          {!isExpanded && (
            <span className="text-[#0a66c2] hover:underline ml-1">...see more</span>
          )}
        </div>
      </Link>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {post.tags.map((tag) => (
            <Tag key={tag} tag={tag} onClick={onTagClick ? () => onTagClick(tag) : undefined} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-3 border-t border-[#e0dfdc]">
        <button
          onClick={onUpvote}
          className={`flex items-center gap-1 text-sm ${
            post.hasUpvoted ? "text-[#0a66c2]" : "text-[#666666] hover:text-[#0a66c2]"
          }`}
        >
          <UpvoteIcon filled={post.hasUpvoted} />
          <span>{post.upvoteCount}</span>
        </button>
        <Link
          href={`/posts/${post._id}`}
          className="flex items-center gap-1 text-sm text-[#666666] hover:text-[#0a66c2]"
        >
          <CommentIcon />
          <span>{post.commentCount}</span>
        </Link>
      </div>
    </Card>
  );
}

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength).trim();
}

function UpvoteIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg className="w-5 h-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

