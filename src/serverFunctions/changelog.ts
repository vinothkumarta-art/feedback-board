import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as changelog from "@/server/changelog";
import { linkableRequests } from "@/server/requests";
import { requireAdmin } from "@/server/guards";
import { memberMiddleware } from "./middleware";

export const getChangelog = createServerFn()
  .middleware([memberMiddleware])
  .handler(() => changelog.listEntries());

export const getEntryEditor = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().nullable() }).parse(data))
  .handler(async ({ data, context: { actor } }) => {
    const entry = data.id ? await changelog.getEntry(data.id) : null;
    if (data.id && !entry) throw new Error("No such entry");
    return { entry, requests: await linkableRequests(), admin: actor.admin };
  });

export const saveEntry = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => changelog.saveEntryInput.parse(data))
  .handler(({ data, context: { actor } }) => changelog.saveEntry(actor.id, data));

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).strict().parse(data))
  .handler(({ data, context: { actor } }) => {
    requireAdmin(actor);
    return changelog.deleteEntry(data.id);
  });
