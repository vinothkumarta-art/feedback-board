import { createFileRoute } from "@tanstack/react-router";
import { listPublished } from "@/server/changelog";

// Public: published changelog entries only.
export const Route = createFileRoute("/p/api/updates/")({
  server: { handlers: { GET: async () => Response.json({ entries: await listPublished() }) } },
});
