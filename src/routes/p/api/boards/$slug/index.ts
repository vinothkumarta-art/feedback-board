import { createFileRoute } from "@tanstack/react-router";
import { getBoardBySlug } from "@/server/boards";
import { handle, notFound, viewerOf, viewerSummary } from "@/server/publicApi";
import { hasVoted, listInput, listRequests } from "@/server/requests";

// Public: a board's requests, with sort, status filter and title search.
export const Route = createFileRoute("/p/api/boards/$slug/")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handle(async () => {
          const board = await getBoardBySlug(params.slug);
          if (!board) return notFound();
          const search = new URL(request.url).searchParams;
          const filters = listInput.parse({
            boardId: board.id,
            sort: search.get("sort") || undefined,
            status: search.get("status") || undefined,
            q: search.get("q") || undefined,
          });
          const user = await viewerOf(request);
          const requests = await listRequests(filters);
          const voted = user
            ? await Promise.all(requests.map((r) => hasVoted(r.id, `u:${user.id}`)))
            : [];
          return Response.json({
            viewer: viewerSummary(user),
            board: { name: board.name, slug: board.slug, description: board.description },
            requests: requests.map((r, i) => ({
              id: r.id,
              title: r.title,
              status: r.status,
              votes: r.votes,
              comments: r.comments,
              createdAt: r.createdAt,
              voted: voted[i] ?? false,
            })),
          });
        }),
    },
  },
});
