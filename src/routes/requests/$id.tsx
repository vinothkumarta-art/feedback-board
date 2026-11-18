import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronUp, GitMerge, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { MemberShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage, formatDateTime } from "@/client/lib/format";
import { STATUSES, STATUS_LABELS, type Status } from "@/server/shared";
import {
  addComment,
  changeStatus,
  deleteComment,
  deleteRequest,
  editComment,
  getRequestDetail,
  mergeRequest,
  setFollowing,
  toggleMyVote,
  voteOnBehalf,
} from "@/serverFunctions/requests";

export const Route = createFileRoute("/requests/$id")({
  loader: ({ params }) => getRequestDetail({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.request.title} · Feedback Board` }] : [],
  }),
  component: RequestPage,
});

type Detail = Awaited<ReturnType<typeof getRequestDetail>>;

function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(work: () => Promise<unknown>, after?: () => void | Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await work();
      await (after ? after() : router.invalidate());
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run };
}

function RequestPage() {
  const detail = Route.useLoaderData();
  const { request, viewer } = detail;
  const navigate = useNavigate();
  const action = useAction();
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (request.mergedIntoId) {
    return (
      <MemberShell>
        <PageHeader title={request.title} backLink={<BackToRequests />} />
        <Alert>
          <AlertDescription>
            Merged into{" "}
            <Link to="/requests/$id" params={{ id: request.mergedIntoId }} className="underline">
              another request
            </Link>
            .
          </AlertDescription>
        </Alert>
      </MemberShell>
    );
  }

  return (
    <MemberShell>
      <PageHeader
        backLink={<BackToRequests />}
        title={<span data-testid="request-title">{request.title}</span>}
        description={
          <span>
            {request.boardName} · {request.authorName}
            {request.authorUserId ? " (team)" : ` <${request.authorEmail}>`}
            {request.source === "on_behalf" ? " · posted for them by the team" : ""} ·{" "}
            {formatDateTime(request.createdAt)}
          </span>
        }
        actions={
          viewer.admin ? (
            <>
              <Button variant="outline" data-testid="merge-button" onClick={() => setMerging(true)}>
                <GitMerge aria-hidden />
                Merge
              </Button>
              <Button variant="outline" data-testid="delete-request" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="h-auto flex-col gap-0 px-4 py-1.5"
          aria-label="Vote"
          onClick={() => action.run(() => toggleMyVote({ data: { id: request.id } }))}
          disabled={action.pending}
        >
          <ChevronUp aria-hidden />
          <span data-testid="vote-count" className="text-base font-semibold">
            {request.votes}
          </span>
        </Button>
        <SimpleSelect
          label="Status"
          testId="status-select"
          value={request.status}
          disabled={action.pending}
          items={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={(status) => action.run(() => changeStatus({ data: { id: request.id, status: status as Status } }))}
        />
        <Button
          variant={detail.following ? "secondary" : "outline"}
          data-testid="follow-button"
          disabled={action.pending}
          onClick={() => action.run(() => setFollowing({ data: { id: request.id, follow: !detail.following } }))}
        >
          {detail.following ? "Following" : "Follow"}
        </Button>
      </div>
      {action.error ? (
        <Alert variant="destructive">
          <AlertDescription>{action.error}</AlertDescription>
        </Alert>
      ) : null}

      {request.description ? <p className="text-sm whitespace-pre-wrap">{request.description}</p> : null}

      <VoteForCustomer id={request.id} />

      <Timeline detail={detail} />

      <CommentForm id={request.id} />

      {merging ? <MergeDialog detail={detail} onClose={() => setMerging(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete this request?"
          confirmLabel="Delete"
          destructive
          pending={action.pending}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            action.run(
              () => deleteRequest({ data: { id: request.id } }),
              () => navigate({ to: "/" }),
            )
          }
        >
          Its votes and comments are deleted too.
        </ConfirmDialog>
      ) : null}
    </MemberShell>
  );
}

function BackToRequests() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden />
      Requests
    </Link>
  );
}

function VoteForCustomer({ id }: { id: string }) {
  const action = useAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Add a customer's vote</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await action.run(() => voteOnBehalf({ data: { id, name, email } }))) {
            setName("");
            setEmail("");
          }
        }}
      >
        <Input
          aria-label="Customer name"
          placeholder="Name"
          data-testid="onbehalf-name"
          className="w-40"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          aria-label="Customer email"
          placeholder="Email"
          type="email"
          data-testid="onbehalf-email"
          className="w-56"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" variant="outline" data-testid="onbehalf-vote" pending={action.pending}>
          Add vote
        </Button>
      </form>
      {action.error ? <p className="text-sm text-destructive">{action.error}</p> : null}
    </section>
  );
}

type TimelineItem =
  | { type: "comment"; at: string; comment: Detail["comments"][number] }
  | { type: "event"; at: string; event: Detail["events"][number] };

function Timeline({ detail }: { detail: Detail }) {
  const items: TimelineItem[] = [
    ...detail.comments.map((comment) => ({ type: "comment" as const, at: comment.createdAt, comment })),
    ...detail.events.map((event) => ({ type: "event" as const, at: event.createdAt, event })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Activity</h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : null}
      <ul className="space-y-3">
        {items.map((item) =>
          item.type === "comment" ? (
            <CommentItem key={item.comment.id} comment={item.comment} admin={detail.viewer.admin} />
          ) : (
            <li key={item.event.id} data-testid="timeline-event" className="text-sm text-muted-foreground">
              {item.event.kind === "merge"
                ? `${item.event.actorName} merged “${item.event.detail}” into this request`
                : `${item.event.actorName} changed the status to ${STATUS_LABELS[item.event.toStatus as Status] ?? item.event.toStatus}`}{" "}
              · {formatDateTime(item.event.createdAt)}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function CommentItem({ comment, admin }: { comment: Detail["comments"][number]; admin: boolean }) {
  const action = useAction();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [deleting, setDeleting] = useState(false);
  return (
    <li data-testid="comment" className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{comment.authorName}</span>
        {comment.team ? null : <span>{comment.authorEmail}</span>}
        {comment.internal ? <Badge variant="secondary">Internal</Badge> : null}
        <span>{formatDateTime(comment.createdAt)}</span>
        {comment.updatedAt ? <span>(edited)</span> : null}
        <span className="ml-auto flex gap-1">
          {comment.mine && !editing ? (
            <Button size="sm" variant="ghost" data-testid="comment-edit" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {comment.mine || admin ? (
            <Button size="sm" variant="ghost" data-testid="comment-delete" onClick={() => setDeleting(true)}>
              Delete
            </Button>
          ) : null}
        </span>
      </div>
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await action.run(() => editComment({ data: { id: comment.id, body } }))) setEditing(false);
          }}
        >
          <Textarea aria-label="Comment" data-testid="comment-edit-input" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" data-testid="comment-edit-save" pending={action.pending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
      )}
      {action.error ? <p className="text-sm text-destructive">{action.error}</p> : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete this comment?"
          confirmLabel="Delete"
          destructive
          pending={action.pending}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await action.run(() => deleteComment({ data: { id: comment.id } }));
            setDeleting(false);
          }}
        />
      ) : null}
    </li>
  );
}

function CommentForm({ id }: { id: string }) {
  const action = useAction();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await action.run(() => addComment({ data: { id, body, internal } }))) {
          setBody("");
          setInternal(false);
        }
      }}
    >
      <Textarea
        aria-label="Comment"
        placeholder="Write a comment"
        data-testid="comment-input"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox data-testid="comment-internal" checked={internal} onCheckedChange={(v) => setInternal(v === true)} />
          Internal (team only)
        </Label>
        <Button type="submit" data-testid="comment-submit" pending={action.pending}>
          Comment
        </Button>
      </div>
      {action.error ? <p className="text-sm text-destructive">{action.error}</p> : null}
    </form>
  );
}

function MergeDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const navigate = useNavigate();
  const action = useAction();
  const [target, setTarget] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && !action.pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge into another request</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Original request</Label>
          <SimpleSelect
            label="Original request"
            testId="merge-target"
            className="w-full"
            value={target}
            items={detail.mergeTargets.map((r) => ({ value: r.id, label: r.title }))}
            onChange={setTarget}
          />
          <p className="text-sm text-muted-foreground">
            Votes, comments and followers move to it, and this request's link leads there.
          </p>
          {action.error ? <p className="text-sm text-destructive">{action.error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={action.pending}>
            Cancel
          </Button>
          <Button
            data-testid="merge-confirm"
            disabled={!target}
            pending={action.pending}
            onClick={() =>
              action.run(
                () => mergeRequest({ data: { id: detail.request.id, into: target } }),
                async () => {
                  onClose();
                  await navigate({ to: "/requests/$id", params: { id: target } });
                },
              )
            }
          >
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
