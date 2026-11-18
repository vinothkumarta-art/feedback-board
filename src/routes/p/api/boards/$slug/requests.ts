import { createFileRoute } from "@tanstack/react-router";
import { getBoardBySlug } from "@/server/boards";
import { handle, notFound, personFrom, readBody, viewerOf } from "@/server/publicApi";
import { createRequest, requestFields } from "@/server/requests";

// Public: a guest (name and email) or a signed-in member posts a request.
export const Route = createFileRoute("/p/api/boards/$slug/requests")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handle(async () => {
          const board = await getBoardBySlug(params.slug);
          if (!board) return notFound();
          const body = await readBody(request);
          const fields = requestFields.parse(body);
          const user = await viewerOf(request);
          const author = personFrom(user, body);
          const created = await createRequest({
            boardId: board.id,
            ...fields,
            author,
            source: "board",
            postedByUserId: user?.id ?? null,
          });
          return Response.json(created, { status: 201 });
        }),
    },
  },
});
