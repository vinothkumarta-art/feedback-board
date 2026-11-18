import { createFileRoute } from "@tanstack/react-router";
import { listBoards } from "@/server/boards";

// Public: the boards a visitor can post to.
export const Route = createFileRoute("/p/api/boards/")({
  server: {
    handlers: {
      GET: async () => {
        const boards = await listBoards();
        return Response.json({
          boards: boards.map(({ name, slug, description }) => ({ name, slug, description })),
        });
      },
    },
  },
});
