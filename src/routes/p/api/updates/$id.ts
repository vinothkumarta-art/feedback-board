import { createFileRoute } from "@tanstack/react-router";
import { getPublished } from "@/server/changelog";
import { notFound } from "@/server/publicApi";

// Public: one published entry; drafts and scheduled entries are not found.
export const Route = createFileRoute("/p/api/updates/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const entry = await getPublished(params.id);
        return entry ? Response.json({ entry }) : notFound();
      },
    },
  },
});
