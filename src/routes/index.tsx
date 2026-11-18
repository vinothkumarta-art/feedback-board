import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { MessageSquare, Plus, ChevronUp } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { MemberShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
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
import { errorMessage, formatDate } from "@/client/lib/format";
import { STATUSES, STATUS_LABELS } from "@/server/shared";
import { getRequests, postOnBehalf } from "@/serverFunctions/requests";

const search = z.object({
  board: z.string().optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  sort: z.enum(["votes", "newest"]).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getRequests({
      data: { boardId: deps.board, status: deps.status, sort: deps.sort ?? "votes", q: deps.q },
    }),
  head: () => ({ meta: [{ title: "Requests · Feedback Board" }] }),
  component: RequestsPage,
});

const ALL = "all";

function RequestsPage() {
  const { requests, boards } = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [query, setQuery] = useState(filters.q ?? "");
  const [posting, setPosting] = useState(false);
  const filtered = Boolean(filters.board || filters.status || filters.q);

  function setFilter(change: Partial<z.infer<typeof search>>) {
    void navigate({ search: (prev) => ({ ...prev, ...change }), replace: true });
  }

  return (
    <MemberShell>
      <PageHeader
        title="Requests"
        actions={
          <Button data-testid="new-request" onClick={() => setPosting(true)} disabled={boards.length === 0}>
            <Plus aria-hidden />
            New request
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="min-w-48 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter({ q: query.trim() || undefined });
          }}
        >
          <Input
            data-testid="search-input"
            type="search"
            placeholder="Search titles"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => setFilter({ q: query.trim() || undefined })}
          />
        </form>
        <SimpleSelect
          label="Board"
          testId="board-filter"
          value={filters.board ?? ALL}
          items={[{ value: ALL, label: "All boards" }, ...boards.map((b) => ({ value: b.id, label: b.name }))]}
          onChange={(value) => setFilter({ board: value === ALL ? undefined : value })}
        />
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
        boards.length === 0 ? (
          <EmptyState
            title="No boards yet"
            description="An admin adds boards in Settings. Requests posted to them appear here."
          />
        ) : (
          <EmptyState
            kind={filtered ? "filtered" : "no-data"}
            title={filtered ? "No requests match" : "No requests yet"}
            description={filtered ? undefined : "Share a board's public link, or post one for a customer."}
          />
        )
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {requests.map((request) => (
            <li key={request.id} data-testid="request-row" className="flex items-center gap-4 px-4 py-3">
              <div className="flex w-12 shrink-0 flex-col items-center text-sm font-medium">
                <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
                <span aria-label="Votes">{request.votes}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  to="/requests/$id"
                  params={{ id: request.id }}
                  className="block truncate font-medium hover:underline"
                >
                  {request.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={request.status} />
                  <span>{request.boardName}</span>
                  <span>{formatDate(request.createdAt)}</span>
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
      {posting ? (
        <PostForCustomer
          boards={boards}
          defaultBoard={filters.board ?? boards[0]?.id ?? ""}
          onClose={() => setPosting(false)}
        />
      ) : null}
    </MemberShell>
  );
}

function PostForCustomer({
  boards,
  defaultBoard,
  onClose,
}: {
  boards: { id: string; name: string }[];
  defaultBoard: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [boardId, setBoardId] = useState(defaultBoard);
  const [form, setForm] = useState({ title: "", description: "", name: "", email: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await postOnBehalf({ data: { boardId, ...form } });
      await router.invalidate();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post for a customer</DialogTitle>
        </DialogHeader>
        <form id="post-for-customer" className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Board</Label>
            <SimpleSelect
              label="Board"
              testId="nr-board"
              className="w-full"
              value={boardId}
              items={boards.map((b) => ({ value: b.id, label: b.name }))}
              onChange={setBoardId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nr-title">Title</Label>
            <Input id="nr-title" data-testid="nr-title" value={form.title} onChange={set("title")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nr-description">Details</Label>
            <Textarea id="nr-description" data-testid="nr-description" value={form.description} onChange={set("description")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nr-name">Customer name</Label>
              <Input id="nr-name" data-testid="nr-name" value={form.name} onChange={set("name")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nr-email">Customer email</Label>
              <Input id="nr-email" data-testid="nr-email" type="email" value={form.email} onChange={set("email")} required />
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="post-for-customer" data-testid="nr-submit" pending={pending}>
            Post request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
