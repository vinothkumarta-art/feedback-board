import { createFileRoute } from "@tanstack/react-router";
import { getBoardBySlug } from "@/server/boards";
import { notFound } from "@/server/publicApi";
import { similarRequests } from "@/server/requests";

// Public: requests in the board whose titles share words with `q`.
export const Route = createFileRoute("/p/api/boards/$slug/similar")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const board = await getBoardBySlug(params.slug);
        if (!board) return notFound();
        const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200);
        return Response.json({ requests: await similarRequests(board.id, q) });
      },
    },
  },
});
