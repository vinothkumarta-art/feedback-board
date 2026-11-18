import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, personFrom, readBody, viewerOf } from "@/server/publicApi";
import { addComment, commentBody } from "@/server/requests";

// Public: a guest or member comments. Comments posted here are never internal.
export const Route = createFileRoute("/p/api/requests/$id/comments")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handle(async () => {
          const body = await readBody(request);
          const { body: text } = z.object({ body: commentBody }).parse(body);
          const user = await viewerOf(request);
          const created = await addComment(params.id, personFrom(user, body), text, false);
          return Response.json(created, { status: 201 });
        }),
    },
  },
});
