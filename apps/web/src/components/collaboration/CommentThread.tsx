import { useState } from 'react'
import { MessageSquare, Pin, Trash2, Reply } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useComments, useCreateComment, usePinComment, useDeleteComment } from '@/hooks/useComments'
import { useAuthStore } from '@/stores/authStore'
import type { Comment } from '@/types'

interface Props {
  entityType: Comment['entityType']
  entityId: string
  canModerate?: boolean
}

export function CommentThread({ entityType, entityId, canModerate = false }: Props) {
  const { user } = useAuthStore()
  const { data: comments = [], isLoading } = useComments(entityType, entityId)
  const createComment = useCreateComment()
  const pinComment = usePinComment()
  const deleteComment = useDeleteComment()

  const [newBody, setNewBody] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')

  const topLevel = comments.filter((c) => !c.parentCommentId)
  const replies = (parentId: string) => comments.filter((c) => c.parentCommentId === parentId)

  function submitComment(parentCommentId?: string) {
    const body = parentCommentId ? replyBody : newBody
    if (!body.trim()) return
    createComment.mutate(
      { entityType, entityId, body: body.trim(), parentCommentId },
      {
        onSuccess: () => {
          if (parentCommentId) { setReplyTo(null); setReplyBody('') }
          else setNewBody('')
        },
      },
    )
  }

  function CommentCard({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) {
    const isOwn = comment.authorId === user?.id
    const isPM = canModerate || user?.role === 'admin'

    return (
      <div className={cn('group', isReply && 'ml-8 border-l-2 border-muted pl-3')}>
        <div className={cn('rounded-lg p-3 text-sm space-y-1', comment.isPinned && 'border border-primary/30 bg-primary/5')}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-xs">{comment.authorName}</span>
            {comment.isPinned && <Pin className="w-3 h-3 text-primary" />}
            <span className="text-xs text-muted-foreground ml-auto">{formatDate(comment.createdAt)}</span>
            {comment.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isReply && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              >
                <Reply className="w-3 h-3" /> Reply
              </button>
            )}
            {isPM && (
              <button
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 ml-2"
                onClick={() => pinComment.mutate({ id: comment.id, entityType, entityId })}
              >
                <Pin className="w-3 h-3" /> {comment.isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                aria-label="Delete comment"
                title="Delete comment"
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 ml-2"
                onClick={() => {
                  if (confirm('Delete this comment?')) {
                    deleteComment.mutate({ id: comment.id, entityType, entityId })
                  }
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {replyTo === comment.id && (
          <div className="ml-8 mt-2 space-y-1">
            <textarea
              rows={2}
              className="w-full text-sm border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Write a reply…"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={!replyBody.trim() || createComment.isPending}
                onClick={() => submitComment(comment.id)}>Reply</Button>
              <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyBody('') }}>Cancel</Button>
            </div>
          </div>
        )}

        {replies(comment.id).map((r) => <CommentCard key={r.id} comment={r} isReply />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Comments ({topLevel.length})</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {topLevel.map((c) => <CommentCard key={c.id} comment={c} />)}
          {topLevel.length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet. Be the first!</p>
          )}
        </div>
      )}

      {user && (
        <div className="space-y-2 border-t pt-3">
          <textarea
            rows={2}
            className="w-full text-sm border rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Add a comment… use @name to mention someone"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') submitComment() }}
          />
          <Button size="sm" disabled={!newBody.trim() || createComment.isPending}
            onClick={() => submitComment()}>
            {createComment.isPending ? 'Posting…' : 'Comment'}
          </Button>
        </div>
      )}
    </div>
  )
}
