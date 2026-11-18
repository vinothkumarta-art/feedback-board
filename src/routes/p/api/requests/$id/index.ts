import { createFileRoute } from "@tanstack/react-router";
import { handle, notFound, viewerOf, viewerSummary } from "@/server/publicApi";
import { getRequestRow, hasVoted, listComments, listEvents } from "@/server/requests";

// Public: one request with its public comments and status history. Never
// internal comments, email addresses or who on the team acted.
export const Route = createFileRoute("/p/api/requests/$id/")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handle(async () => {
          const row = await getRequestRow(params.id);
          if (!row) return notFound();
          if (row.mergedIntoId) return Response.json({ mergedInto: row.mergedIntoId });
          const user = await viewerOf(request);
          const [comments, events] = await Promise.all([
            listComments(row.id, { includeInternal: false }),
            listEvents(row.id),
          ]);
          return Response.json({
            viewer: viewerSummary(user),
            request: {
              id: row.id,
              title: row.title,
              description: row.description,
              status: row.status,
              votes: row.votes,
              createdAt: row.createdAt,
              board: { name: row.boardName, slug: row.boardSlug },
              author: { name: row.authorName, team: row.authorUserId !== null },
              voted: user ? await hasVoted(row.id, `u:${user.id}`) : false,
            },
            comments: comments.map((c) => ({
              id: c.id,
              body: c.body,
              authorName: c.authorName,
              team: c.authorUserId !== null,
              createdAt: c.createdAt,
            })),
            events: events
              .filter((e) => e.kind === "status")
              .map((e) => ({ id: e.id, status: e.toStatus, createdAt: e.createdAt })),
          });
        }),
    },
  },
});
