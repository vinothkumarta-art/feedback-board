import { createFileRoute } from "@tanstack/react-router";
import { notFound } from "@/server/publicApi";
import { unsubscribe } from "@/server/requests";

// Public: the link in a status email. The token is the only key.
export const Route = createFileRoute("/p/api/unsubscribe/$token")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const row = await unsubscribe(params.token);
        return row ? Response.json({ ok: true }) : notFound();
      },
    },
  },
});
