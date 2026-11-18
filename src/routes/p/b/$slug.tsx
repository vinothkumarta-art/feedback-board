import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { PublicShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { GuestFields, PublicError, PublicNotFound, VoteButton, useGuest } from "@/client/components/PublicParts";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/format";
import { getPublic, postPublic, reloadPublic, saveGuest, type Viewer } from "@/client/lib/publicApi";
import { STATUSES, STATUS_LABELS } from "@/server/shared";

interface BoardData {
  viewer: Viewer;
  board: { name: string; slug: string; description: string };
  requests: { id: string; title: string; status: string; votes: number; comments: number; voted: boolean }[];
}

const search = z.object({
  sort: z.enum(["votes", "newest"]).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/p/b/$slug")({
  ssr: false,
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    const query = new URLSearchParams();
    if (deps.sort) query.set("sort", deps.sort);
    if (deps.status) query.set("status", deps.status);
    if (deps.q) query.set("q", deps.q);
    return getPublic<BoardData>(`/p/api/boards/${encodeURIComponent(params.slug)}?${query}`);
  },
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.board.name }] : [] }),
  component: BoardPage,
  notFoundComponent: PublicNotFound,
  errorComponent: PublicError,
});

const ALL = "all";

function BoardPage() {
  const { board, requests, viewer } = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/p/b/$slug" });
  const [query, setQuery] = useState(filters.q ?? "");
  const filtered = Boolean(filters.status || filters.q);

  function setFilter(change: Partial<z.infer<typeof search>>) {
    void navigate({ search: (prev) => ({ ...prev, ...change }), replace: true });
  }

  return (
    <PublicShell>
      <PageHeader title={board.name} description={board.description || undefined} />
      <PostForm slug={board.slug} viewer={viewer} />
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="min-w-40 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter({ q: query.trim() || undefined });
          }}
        >
          <Input
            type="search"
            data-testid="search-input"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setFilter({ q: query.trim() || undefined })}
          />
        </form>
        <SimpleSelect
          label="Status"
          testId="status-filter"
          value={filters.status ?? ALL}
          items={[{ value: ALL, label: "Any status" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
          onChange={(value) => setFilter({ status: value === ALL ? undefined : (value as (typeof STATUSES)[number]) })}
        />
        <SimpleSelect
          label="Sort"
          testId="sort-select"
          value={filters.sort ?? "votes"}
          items={[
            { value: "votes", label: "Most votes" },
            { value: "newest", label: "Newest" },
          ]}
          onChange={(value) => setFilter({ sort: value === "votes" ? undefined : (value as "newest") })}
        />
      </div>
      {requests.length === 0 ? (
        <EmptyState
          kind={filtered ? "filtered" : "no-data"}
          title={filtered ? "No requests match" : "No requests yet"}
          description={filtered ? undefined : "Be the first to post one."}
        />
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.id} data-testid="request-item" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <VoteButton requestId={request.id} votes={request.votes} voted={request.voted} viewer={viewer} />
              <div className="min-w-0 flex-1 space-y-1">
                <Link to="/p/r/$id" params={{ id: request.id }} className="block font-medium hover:underline">
                  {request.title}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={request.status} />
                  {request.comments > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3" aria-hidden />
                      {request.comments}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}

function PostForm({ slug, viewer }: { slug: string; viewer: Viewer }) {
  const router = useRouter();
  const { guest, setGuest } = useGuest();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [similar, setSimilar] = useState<{ id: string; title: string; votes: number }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = title.trim();
    if (q.length < 3) {
      setSimilar([]);
      return;
    }
    const timer = setTimeout(() => {
      getPublic<{ requests: typeof similar }>(`/p/api/boards/${encodeURIComponent(slug)}/similar?q=${encodeURIComponent(q)}`)
        .then((data) => setSimilar(data.requests))
        .catch(() => setSimilar([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [title, slug]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post a request</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            try {
              await postPublic(`/p/api/boards/${encodeURIComponent(slug)}/requests`, {
                title,
                description,
                ...(viewer.member ? {} : guest),
              });
              if (!viewer.member) saveGuest(guest);
              setTitle("");
              setDescription("");
              await reloadPublic(router);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input id="post-title" data-testid="post-title" value={title} required onChange={(e) => setTitle(e.target.value)} />
          </div>
          {similar.length > 0 ? (
            <div data-testid="similar-requests" className="space-y-1 rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">Already asked? Vote for it instead:</p>
              <ul className="space-y-1">
                {similar.map((r) => (
                  <li key={r.id}>
                    <Link to="/p/r/$id" params={{ id: r.id }} className="hover:underline">
                      {r.title}
                    </Link>{" "}
                    <span className="text-muted-foreground">· {r.votes} {r.votes === 1 ? "vote" : "votes"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="post-description">Details</Label>
            <Textarea id="post-description" data-testid="post-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {viewer.member ? null : <GuestFields guest={guest} onChange={setGuest} />}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" data-testid="post-submit" pending={pending}>
            Post request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
