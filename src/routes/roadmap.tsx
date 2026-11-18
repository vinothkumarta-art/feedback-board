import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { MemberShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { errorMessage } from "@/client/lib/format";
import { ROADMAP_STATUSES, STATUSES, STATUS_LABELS, type Status } from "@/server/shared";
import { changeStatus, getRoadmap } from "@/serverFunctions/requests";

export const Route = createFileRoute("/roadmap")({
  validateSearch: z.object({ board: z.string().optional().catch(undefined) }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getRoadmap({ data: { boardId: deps.board } }),
  head: () => ({ meta: [{ title: "Roadmap · Feedback Board" }] }),
  component: RoadmapPage,
});

const ALL = "all";

function RoadmapPage() {
  const { requests, boards } = Route.useLoaderData();
  const { board } = Route.useSearch();
  const navigate = useNavigate({ from: "/roadmap" });
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(id: string, status: Status) {
    setError(null);
    try {
      await changeStatus({ data: { id, status } });
      await router.invalidate();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <MemberShell>
      <PageHeader
        title="Roadmap"
        actions={
          <SimpleSelect
            label="Board"
            value={board ?? ALL}
            items={[{ value: ALL, label: "All boards" }, ...boards.map((b) => ({ value: b.id, label: b.name }))]}
            onChange={(value) => navigate({ search: { board: value === ALL ? undefined : value } })}
          />
        }
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {ROADMAP_STATUSES.map((status) => {
          const cards = requests.filter((r) => r.status === status);
          return (
            <section
              key={status}
              data-testid={`column-${status}`}
              className="space-y-3 rounded-xl border border-border bg-muted/40 p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragging) void move(dragging, status);
                setDragging(null);
              }}
            >
              <h2 className="flex items-center justify-between text-sm font-medium">
                {STATUS_LABELS[status]}
                <span className="text-muted-foreground">{cards.length}</span>
              </h2>
              {cards.map((card) => (
                <article
                  key={card.id}
                  data-testid="roadmap-card"
                  draggable
                  onDragStart={() => setDragging(card.id)}
                  className="space-y-2 rounded-lg border border-border bg-card p-3"
                >
                  <Link to="/requests/$id" params={{ id: card.id }} className="block text-sm font-medium hover:underline">
                    {card.title}
                  </Link>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {card.boardName} · {card.votes} {card.votes === 1 ? "vote" : "votes"}
                    </span>
                    <SimpleSelect
                      label="Move to"
                      testId="card-status"
                      size="sm"
                      value={card.status}
                      items={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                      onChange={(next) => move(card.id, next as Status)}
                    />
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </MemberShell>
  );
}
