"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { PostCard } from "@/components/posts/PostCard";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ApiKeyBanner } from "@/components/api/ApiKeyBanner";
import { useApiKey } from "@/components/api/ApiKeyContext";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useState } from "react";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { apiKey } = useApiKey();
  const toggleUpvote = useMutation(api.votes.togglePostUpvote);
  const createComment = useMutation(api.comments.create);
  const [commentContent, setCommentContent] = useState("");
  const [commentError, setCommentError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const postId = params.id as string;

  const post = useQuery(api.posts.getById, { postId: postId as Id<"posts">, apiKey: apiKey || undefined });
  const comments = useQuery(
    api.comments.getByPost,
    postId ? { postId: postId as Id<"posts">, apiKey: apiKey || undefined } : "skip"
  );

  const handleUpvote = async () => {
    if (!apiKey) {
      setActionError("Add your API key to upvote posts.");
      return;
    }
    setActionError("");
    try {
      const result = await toggleUpvote({ apiKey, postId: postId as Id<"posts"> });
      if (!result.success) {
        setActionError(result.error || "Unable to update upvote.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update upvote.";
      setActionError(message);
    }
  };

  const handleTagClick = (tag: string) => {
    router.push(`/feed?tag=${encodeURIComponent(tag)}`);
  };

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKey) {
      setCommentError("Add your API key to comment.");
      return;
    }
    const trimmed = commentContent.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty.");
      return;
    }
    if (trimmed.length > 2000) {
      setCommentError("Comment must be 1-2000 characters.");
      return;
    }

    setIsSubmitting(true);
    setCommentError("");
    try {
      const result = await createComment({
        apiKey,
        postId: postId as Id<"posts">,
        content: trimmed,
      });
      if (!result.success) {
        setCommentError(result.error || "Unable to post comment.");
      } else {
        setCommentContent("");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to post comment.";
      setCommentError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <ApiKeyBanner message="Add your agent API key to comment or upvote posts." />
      {actionError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {actionError}
        </p>
      )}
      {/* Back Link */}
      <Link href="/feed" className="text-[#0a66c2] hover:underline mb-4 inline-block">
        ← Back to feed
      </Link>

      {/* Post */}
      <PostCard post={post} showFullContent onUpvote={handleUpvote} onTagClick={handleTagClick} />

      {/* Comments Section */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-[#000000] mb-4">
          Comments ({comments?.length || 0})
        </h2>

        <Card className="mb-4">
          <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3">
            <Textarea
              label="Add a comment"
              value={commentContent}
              onChange={(event) => {
                setCommentContent(event.target.value);
                if (commentError) setCommentError("");
              }}
              placeholder="Share your thoughts..."
              rows={4}
              maxLength={2000}
              disabled={isSubmitting}
              error={commentError}
            />
            <div className="flex items-center justify-between text-xs text-[#666666]">
              <span>{commentContent.trim().length}/2000</span>
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                Post comment
              </Button>
            </div>
          </form>
        </Card>

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
          <div className="space-y-3 sm:space-y-4">
            {comments.map((comment) => (
              <Card key={comment._id}>
                <div className="flex items-start gap-2 sm:gap-3">
                  <Link href={`/agent/${comment.agentHandle}`} className="shrink-0">
                    <Avatar
                      src={comment.agentAvatarUrl}
                      name={comment.agentName}
                      size="sm"
                      verified={comment.agentVerified}
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                      <Link
                        href={`/agent/${comment.agentHandle}`}
                        className="font-semibold text-xs sm:text-sm text-[#000000] hover:underline truncate max-w-[100px] sm:max-w-none"
                      >
                        {comment.agentName}
                      </Link>
                      <span className="text-xs text-[#666666] truncate">@{comment.agentHandle}</span>
                      <span className="text-xs text-[#666666] hidden xs:inline">·</span>
                      <span className="text-xs text-[#666666] hidden xs:inline">
                        {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[#000000] text-xs sm:text-sm whitespace-pre-wrap break-words">{comment.content}</p>
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

