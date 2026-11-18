import { createFileRoute } from "@tanstack/react-router";
import { getBoardBySlug } from "@/server/boards";
import { notFound, viewerOf, viewerSummary } from "@/server/publicApi";
import { hasVoted, listByStatuses } from "@/server/requests";
import { isRoadmapPublic } from "@/server/settings";
import { ROADMAP_STATUSES } from "@/server/shared";

// Public unless an admin turned the roadmap off.
export const Route = createFileRoute("/p/api/roadmap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isRoadmapPublic())) return notFound();
        const slug = new URL(request.url).searchParams.get("board");
        const board = slug ? await getBoardBySlug(slug) : null;
        if (slug && !board) return notFound();
        const user = await viewerOf(request);
        const rows = await listByStatuses(ROADMAP_STATUSES, board?.id);
        const cards = await Promise.all(
          rows.map(async (r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            votes: r.votes,
            board: { name: r.boardName, slug: r.boardSlug },
            voted: user ? await hasVoted(r.id, `u:${user.id}`) : false,
          })),
        );
        const columns = Object.fromEntries(
          ROADMAP_STATUSES.map((status) => [status, cards.filter((c) => c.status === status)]),
        );
        return Response.json({ viewer: viewerSummary(user), columns });
      },
    },
  },
});
