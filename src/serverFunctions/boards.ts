import { createServerFn } from "@tanstack/react-start";
import * as boards from "@/server/boards";
import { isRoadmapPublic, setRoadmapPublic } from "@/server/settings";
import { requireAdmin } from "@/server/guards";
import { memberMiddleware } from "./middleware";
import { z } from "zod";

export const getSettings = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context: { actor } }) => ({
    boards: await boards.listBoards(),
    roadmapPublic: await isRoadmapPublic(),
    admin: actor.admin,
  }));

export const createBoard = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => boards.createBoardInput.parse(data))
  .handler(({ data, context: { actor } }) => {
    requireAdmin(actor);
    return boards.createBoard(data);
  });

export const updateBoard = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => boards.updateBoardInput.parse(data))
  .handler(({ data, context: { actor } }) => {
    requireAdmin(actor);
    return boards.updateBoard(data);
  });

export const deleteBoard = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => boards.boardIdInput.parse(data))
  .handler(({ data, context: { actor } }) => {
    requireAdmin(actor);
    return boards.deleteBoard(data.id);
  });

export const updateRoadmapPublic = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ value: z.boolean() }).strict().parse(data))
  .handler(({ data, context: { actor } }) => {
    requireAdmin(actor);
    return setRoadmapPublic(data.value);
  });
