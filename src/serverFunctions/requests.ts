import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env, waitUntil } from "cloudflare:workers";
import { z } from "zod";
import { listBoards } from "@/server/boards";
import { sendStatusEmails } from "@/server/notify";
import * as requests from "@/server/requests";
import {
  ROADMAP_STATUSES,
  customerInput,
  customerPerson,
  memberPerson,
  statusSchema,
} from "@/server/shared";
import { refusingMissing, requireAdmin } from "@/server/guards";
import { memberMiddleware } from "./middleware";

const idInput = z.object({ id: z.string() }).strict();

export const getRequests = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => requests.listInput.parse(data))
  .handler(async ({ data }) => ({
    requests: await requests.listRequests(data),
    boards: await listBoards(),
  }));

export const getRequestDetail = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context: { actor } }) => {
    const request = await requests.getRequestRow(data.id);
    if (!request) throw new Error("No such request");
    const [comments, events, following, others] = await Promise.all([
      requests.listComments(data.id, { includeInternal: true }),
      requests.listEvents(data.id),
      requests.isFollowing(data.id, actor),
      requests.linkableRequests(),
    ]);
    return {
      request,
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        internal: c.internal,
        authorName: c.authorName,
        authorEmail: c.authorEmail,
        team: c.authorUserId !== null,
        mine: c.authorUserId === actor.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      events,
      following,
      mergeTargets: others.filter((r) => r.id !== data.id),
      viewer: { admin: actor.admin, id: actor.id },
    };
  });

export const postOnBehalf = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) =>
    requests.requestFields.merge(customerInput).extend({ boardId: z.string() }).strict().parse(data),
  )
  .handler(async ({ data, context: { actor } }) => {
    if (!(await listBoards()).some((b) => b.id === data.boardId)) throw new Error("No such board");
    return requests.createRequest({
      boardId: data.boardId,
      title: data.title,
      description: data.description,
      author: customerPerson(data.name, data.email),
      source: "on_behalf",
      postedByUserId: actor.id,
    });
  });

export const voteOnBehalf = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => customerInput.extend({ id: z.string() }).strict().parse(data))
  .handler(({ data, context: { actor } }) =>
    requests.addVote(data.id, customerPerson(data.name, data.email), actor.id),
  );

export const toggleMyVote = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { actor } }) => requests.toggleVote(data.id, memberPerson(actor)));

export const addComment = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string(), body: requests.commentBody, internal: z.boolean() }).strict().parse(data),
  )
  .handler(({ data, context: { actor } }) =>
    requests.addComment(data.id, memberPerson(actor), data.body, data.internal),
  );

export const editComment = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string(), body: requests.commentBody }).strict().parse(data))
  .handler(({ data, context: { actor } }) =>
    refusingMissing(() => requests.editComment(actor, data.id, data.body)),
  );

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { actor } }) =>
    refusingMissing(() => requests.deleteComment(actor, data.id)),
  );

export const setFollowing = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string(), follow: z.boolean() }).strict().parse(data))
  .handler(({ data, context: { actor } }) =>
    requests.setFollowing(data.id, memberPerson(actor), data.follow),
  );

export const changeStatus = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string(), status: statusSchema }).strict().parse(data))
  .handler(async ({ data, context: { actor } }) => {
    const notice = await requests.changeStatus(actor, data.id, data.status);
    if (notice && notice.recipients.length > 0) {
      const origin = new URL(getRequest().url).origin;
      waitUntil(sendStatusEmails(env, origin, notice));
    }
    return { status: data.status };
  });

export const mergeRequest = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string(), into: z.string() }).strict().parse(data))
  .handler(({ data, context: { actor } }) => {
    requireAdmin(actor);
    return requests.mergeRequest(actor, data.id, data.into);
  });

export const deleteRequest = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { actor } }) => {
    requireAdmin(actor);
    return requests.deleteRequest(data.id);
  });

export const getRoadmap = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ boardId: z.string().optional() }).parse(data))
  .handler(async ({ data }) => ({
    requests: await requests.listByStatuses(ROADMAP_STATUSES, data.boardId),
    boards: await listBoards(),
  }));

