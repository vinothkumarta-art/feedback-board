import { createFileRoute } from "@tanstack/react-router";
import { handle, personFrom, readBody, viewerOf } from "@/server/publicApi";
import { toggleVote } from "@/server/requests";

// Public: vote, or take the vote back. One per member, one per email.
export const Route = createFileRoute("/p/api/requests/$id/vote")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handle(async () => {
          const user = await viewerOf(request);
          const person = personFrom(user, await readBody(request));
          return Response.json(await toggleVote(params.id, person));
        }),
    },
  },
});
