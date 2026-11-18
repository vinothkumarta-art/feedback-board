import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PublicShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicError, PublicNotFound, VoteButton } from "@/client/components/PublicParts";
import { SimpleSelect } from "@/client/components/SimpleSelect";
import { getPublic, type Viewer } from "@/client/lib/publicApi";
import { ROADMAP_STATUSES, STATUS_LABELS } from "@/server/shared";

interface Card {
  id: string;
  title: string;
  votes: number;
  voted: boolean;
  board: { name: string; slug: string };
}
interface RoadmapData {
  viewer: Viewer;
  columns: Record<(typeof ROADMAP_STATUSES)[number], Card[]>;
}

export const Route = createFileRoute("/p/roadmap")({
  ssr: false,
  validateSearch: z.object({ board: z.string().optional().catch(undefined) }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getPublic<RoadmapData>(`/p/api/roadmap${deps.board ? `?board=${encodeURIComponent(deps.board)}` : ""}`),
  head: () => ({ meta: [{ title: "Roadmap" }] }),
  component: PublicRoadmap,
  notFoundComponent: PublicNotFound,
  errorComponent: PublicError,
});

const ALL = "all";

function PublicRoadmap() {
  const { columns, viewer } = Route.useLoaderData();
  const { board } = Route.useSearch();
  const navigate = useNavigate({ from: "/p/roadmap" });
  const [boards, setBoards] = useState<{ name: string; slug: string }[]>([]);
  useEffect(() => {
    getPublic<{ boards: { name: string; slug: string }[] }>("/p/api/boards")
      .then((data) => setBoards(data.boards))
      .catch(() => setBoards([]));
  }, []);
  return (
    <PublicShell>
      <PageHeader
        title="Roadmap"
        actions={
          boards.length > 1 ? (
            <SimpleSelect
              label="Board"
              value={board ?? ALL}
              items={[{ value: ALL, label: "All boards" }, ...boards.map((b) => ({ value: b.slug, label: b.name }))]}
              onChange={(value) => navigate({ search: { board: value === ALL ? undefined : value } })}
            />
          ) : null
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {ROADMAP_STATUSES.map((status) => (
          <section key={status} data-testid={`column-${status}`} className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
            <h2 className="flex items-center justify-between text-sm font-medium">
              {STATUS_LABELS[status]}
              <span className="text-muted-foreground">{columns[status].length}</span>
            </h2>
            {columns[status].map((card) => (
              <article key={card.id} data-testid="roadmap-card" className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                <VoteButton requestId={card.id} votes={card.votes} voted={card.voted} viewer={viewer} />
                <div className="min-w-0 space-y-1">
                  <Link to="/p/r/$id" params={{ id: card.id }} className="block text-sm font-medium hover:underline">
                    {card.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{card.board.name}</p>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
