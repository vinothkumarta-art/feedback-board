import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { PublicShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { GuestFields, PublicError, PublicNotFound, VoteButton, useGuest } from "@/client/components/PublicParts";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage, formatDate, formatDateTime } from "@/client/lib/format";
import { getPublic, postPublic, reloadPublic, saveGuest, type Viewer } from "@/client/lib/publicApi";
import { STATUS_LABELS, type Status } from "@/server/shared";

interface RequestData {
  mergedInto?: string;
  viewer: Viewer;
  request: {
    id: string;
    title: string;
    description: string;
    status: string;
    votes: number;
    voted: boolean;
    createdAt: string;
    board: { name: string; slug: string };
    author: { name: string; team: boolean };
  };
  comments: { id: string; body: string; authorName: string; team: boolean; createdAt: string }[];
  events: { id: string; status: string; createdAt: string }[];
}

export const Route = createFileRoute("/p/r/$id")({
  ssr: false,
  loader: async ({ params }) => {
    const data = await getPublic<RequestData>(`/p/api/requests/${encodeURIComponent(params.id)}`);
    // A merged request's link leads to the one it was merged into.
    if (data.mergedInto) throw redirect({ to: "/p/r/$id", params: { id: data.mergedInto }, replace: true });
    return data;
  },
  head: ({ loaderData }) => ({ meta: loaderData?.request ? [{ title: loaderData.request.title }] : [] }),
  component: PublicRequestPage,
  notFoundComponent: PublicNotFound,
  errorComponent: PublicError,
});

function PublicRequestPage() {
  const { request, comments, events, viewer } = Route.useLoaderData();
  const items = [
    ...comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, c })),
    ...events.map((e) => ({ kind: "event" as const, at: e.createdAt, e })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <PublicShell>
      <PageHeader
        backLink={
          <Link
            to="/p/b/$slug"
            params={{ slug: request.board.slug }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {request.board.name}
          </Link>
        }
        title={request.title}
        description={`${request.author.name} · ${formatDate(request.createdAt)}`}
      />
      <div className="flex items-start gap-4">
        <VoteButton requestId={request.id} votes={request.votes} voted={request.voted} viewer={viewer} />
        <div className="min-w-0 flex-1 space-y-2">
          <StatusBadge status={request.status} />
          {request.description ? <p className="text-sm whitespace-pre-wrap">{request.description}</p> : null}
        </div>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Comments</h2>
        <ul className="space-y-3">
          {items.map((item) =>
            item.kind === "comment" ? (
              <li key={item.c.id} data-testid="comment" className="space-y-1 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.c.authorName}</span>
                  {item.c.team ? <Badge variant="secondary">Team</Badge> : null}
                  <span>{formatDateTime(item.c.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{item.c.body}</p>
              </li>
            ) : (
              <li key={item.e.id} className="text-sm text-muted-foreground">
                Status changed to {STATUS_LABELS[item.e.status as Status] ?? item.e.status} · {formatDateTime(item.e.createdAt)}
              </li>
            ),
          )}
        </ul>
        <CommentForm id={request.id} viewer={viewer} />
      </section>
    </PublicShell>
  );
}

function CommentForm({ id, viewer }: { id: string; viewer: Viewer }) {
  const router = useRouter();
  const { guest, setGuest } = useGuest();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          await postPublic(`/p/api/requests/${id}/comments`, { body, ...(viewer.member ? {} : guest) });
          if (!viewer.member) saveGuest(guest);
          setBody("");
          await reloadPublic(router);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <Textarea
        aria-label="Comment"
        placeholder="Add a comment"
        data-testid="comment-input"
        value={body}
        required
        onChange={(e) => setBody(e.target.value)}
      />
      {viewer.member ? null : <GuestFields guest={guest} onChange={setGuest} />}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" data-testid="comment-submit" pending={pending}>
        Comment
      </Button>
    </form>
  );
}
