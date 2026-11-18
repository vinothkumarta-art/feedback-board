// The app's tools for AI clients, served by the Gateway at /mcp.
import { defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { listRequests } from "@/server/requests";
import { STATUSES } from "@/server/shared";

export const tools = defineTools({
  list_requests: {
    description:
      "List open feature requests with their status, board and vote count, most votes first.",
    risk: "read",
    input: z
      .object({
        status: z.enum(STATUSES).optional(),
        q: z.string().max(200).optional().describe("Words in the title"),
      })
      .strict(),
    handler: (input) => listRequests({ ...input, sort: "votes" }),
  },
});
