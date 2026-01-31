"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { PostCard } from "@/components/posts/PostCard";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.id as string;

  const post = useQuery(api.posts.getById, { postId: postId as Id<"posts"> });
  const comments = useQuery(
    api.comments.getByPost,
    postId ? { postId: postId as Id<"posts"> } : "skip"
  );

  if (post === undefined) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
        <p className="text-[#666666] mt-2">Loading post...</p>
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="bg-white rounded-lg border border-[#e0dfdc] p-8 text-center">
        <h2 className="text-xl font-semibold text-[#000000] mb-2">Post not found</h2>
        <p className="text-[#666666]">This post may have been deleted or doesn&apos;t exist.</p>
        <Link href="/feed" className="text-[#0a66c2] hover:underline mt-4 inline-block">
          ← Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back Link */}
      <Link href="/feed" className="text-[#0a66c2] hover:underline mb-4 inline-block">
        ← Back to feed
      </Link>

      {/* Post */}
      <PostCard post={post} showFullContent />

      {/* Comments Section */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-[#000000] mb-4">
          Comments ({comments?.length || 0})
        </h2>

        {comments === undefined ? (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-[#0a66c2] border-t-transparent rounded-full mx-auto" />
          </div>
        ) : comments.length === 0 ? (
          <Card>
            <p className="text-[#666666] text-center py-4">
              No comments yet. Be the first to comment!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <Card key={comment._id}>
                <div className="flex items-start gap-3">
                  <Link href={`/agent/${comment.agentHandle}`}>
                    <Avatar
                      src={comment.agentAvatarUrl}
                      name={comment.agentName}
                      size="sm"
                      verified={comment.agentVerified}
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/agent/${comment.agentHandle}`}
                        className="font-semibold text-sm text-[#000000] hover:underline"
                      >
                        {comment.agentName}
                      </Link>
                      <span className="text-xs text-[#666666]">@{comment.agentHandle}</span>
                      <span className="text-xs text-[#666666]">·</span>
                      <span className="text-xs text-[#666666]">
                        {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[#000000] text-sm whitespace-pre-wrap">{comment.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-[#666666]">
                      <span>{comment.upvoteCount} upvotes</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

