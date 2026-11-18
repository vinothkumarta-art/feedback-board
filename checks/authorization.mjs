// Authorization: private pages refuse anonymous and outsiders, public routes
// expose only public data, members can't change each other's objects, admin
// actions refuse non-admins, and the app has no sign-in of its own.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createBoard, getJson, guestPost, postJson, recordServerCalls } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  const db = await runtime.database();
  await createBoard(owner, { name: "Ideas", slug: "ideas", description: "Requests" });
  const id = await guestPost(runtime, "ideas", { title: "Calendar sync", description: "Two-way sync", name: "Pat Guest", email: "pat@guest.example" });

  await runtime.assertPrivateAccess(["/", "/roadmap", "/changelog", "/settings", `/requests/${id}`, "/changelog/new"]);

  // No sign-in page of the app's own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/auth/login", "/logout"]) {
    const response = await runtime.fetch(path, { role: "owner" });
    expect(response.status, path).toBe(404);
  }
  await owner.goto("/");
  await expect(owner.locator("input[type=password]")).toHaveCount(0);
  const publicPage = await (await runtime.context(null)).newPage();
  await publicPage.goto("/p/b/ideas");
  await expect(publicPage.getByTestId("request-item").first()).toBeVisible();
  await expect(publicPage.locator("input[type=password]")).toHaveCount(0);

  // Owner leaves an internal and a public comment; owner drafts a changelog entry.
  await owner.goto(`/requests/${id}`);
  await owner.getByTestId("comment-input").fill("Owner note: check the contract first.");
  await owner.getByTestId("comment-internal").click();
  await owner.getByTestId("comment-submit").click();
  await expect(owner.getByTestId("comment").filter({ hasText: "Owner note" })).toBeVisible();
  await owner.getByTestId("comment-input").fill("Thanks, we are looking at this.");
  await owner.getByTestId("comment-submit").click();
  const ownerComment = owner.getByTestId("comment").filter({ hasText: "we are looking" });
  await expect(ownerComment).toBeVisible();

  // Public routes: no internal comment, no email address.
  const pub = await getJson(runtime, `/p/api/requests/${id}`);
  const text = JSON.stringify(pub);
  expect(text).not.toContain("Owner note");
  expect(text).not.toContain("@");
  expect(text).toContain("we are looking");
  expect((await runtime.fetch(`/p/api/requests/${id}`, { role: "outsider" })).status).toBe(200);
  expect(JSON.stringify(await (await runtime.fetch(`/p/api/requests/${id}`, { role: "outsider" })).json())).not.toContain("Owner note");
  expect((await runtime.fetch("/p/api/boards/nope")).status).toBe(404);
  expect((await runtime.fetch("/p/api/requests/does-not-exist")).status).toBe(404);
  expect((await runtime.fetch("/p/api/unsubscribe/not-a-token", { method: "POST" })).status).toBe(404);

  await owner.goto("/changelog/new");
  await owner.getByTestId("entry-title").fill("Secret launch");
  await owner.getByTestId("entry-body").fill("Not yet.");
  await owner.getByTestId("save-draft").click();
  await expect(owner.getByTestId("entry-state")).toHaveText("Draft");
  const draftId = new URL(owner.url()).pathname.split("/").pop();
  expect(JSON.stringify(await getJson(runtime, "/p/api/updates"))).not.toContain("Secret launch");
  expect((await runtime.fetch(`/p/api/updates/${draftId}`)).status).toBe(404);
  // Members do see drafts in the dashboard.
  await member.goto("/changelog");
  await expect(member.getByTestId("entry-row").filter({ hasText: "Secret launch" })).toBeVisible();

  // A member can't edit or delete the owner's comment: no controls, and the
  // owner's own calls replayed as the member are refused.
  await member.goto(`/requests/${id}`);
  const seen = member.getByTestId("comment").filter({ hasText: "we are looking" });
  await expect(seen).toBeVisible();
  await expect(seen.getByTestId("comment-edit")).toHaveCount(0);
  await expect(seen.getByTestId("comment-delete")).toHaveCount(0);
  await expect(member.getByTestId("delete-request")).toHaveCount(0);
  await expect(member.getByTestId("merge-button")).toHaveCount(0);

  await owner.goto(`/requests/${id}`);
  const calls = await recordServerCalls(owner, { block: true });
  await ownerComment.getByTestId("comment-edit").click();
  await owner.getByTestId("comment-edit-input").fill("Hijacked text");
  await owner.getByTestId("comment-edit-save").click();
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const editCall = calls.pop();
  for (const role of ["member", undefined, "outsider"]) {
    const response = await runtime.fetch(editCall.path, { method: "POST", headers: editCall.headers, body: editCall.body, ...(role ? { role } : {}) });
    expect(response.status, `edit comment as ${role}`).toBeGreaterThanOrEqual(400);
  }
  expect(await db.prepare("select count(*) as n from comments where body = 'Hijacked text'").first()).toMatchObject({ n: 0 });

  await owner.goto(`/requests/${id}`);
  await owner.getByTestId("comment").filter({ hasText: "we are looking" }).getByTestId("comment-delete").click();
  await owner.getByTestId("confirm-delete").click();
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const deleteCommentCall = calls.pop();
  const deleteComment = await runtime.fetch(deleteCommentCall.path, { method: "POST", headers: deleteCommentCall.headers, body: deleteCommentCall.body, role: "member" });
  expect(deleteComment.status).toBeGreaterThanOrEqual(400);
  expect(await db.prepare("select count(*) as n from comments where body like '%we are looking%'").first()).toMatchObject({ n: 1 });

  // Admin-only: delete request, merge, boards, roadmap switch, delete changelog entry.
  await owner.goto(`/requests/${id}`);
  await owner.getByTestId("delete-request").click();
  await owner.getByTestId("confirm-delete").click();
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const deleteRequestCall = calls.pop();
  expect((await runtime.fetch(deleteRequestCall.path, { method: "POST", headers: deleteRequestCall.headers, body: deleteRequestCall.body, role: "member" })).status).toBeGreaterThanOrEqual(400);
  expect((await runtime.fetch(deleteRequestCall.path, { method: "POST", headers: deleteRequestCall.headers, body: deleteRequestCall.body })).status).toBe(401);
  expect(await db.prepare("select count(*) as n from requests where id = ?").bind(id).first()).toMatchObject({ n: 1 });

  await owner.goto("/settings");
  await owner.getByTestId("board-name").fill("Hacked");
  await owner.getByTestId("board-slug").fill("hacked");
  await owner.getByTestId("board-description").fill("x");
  await owner.getByTestId("board-create").click();
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const createBoardCall = calls.pop();
  expect((await runtime.fetch(createBoardCall.path, { method: "POST", headers: createBoardCall.headers, body: createBoardCall.body, role: "member" })).status).toBeGreaterThanOrEqual(400);
  expect(await db.prepare("select count(*) as n from boards where slug = 'hacked'").first()).toMatchObject({ n: 0 });

  await owner.goto("/settings");
  await owner.getByTestId("roadmap-public-switch").click();
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const roadmapCall = calls.pop();
  expect((await runtime.fetch(roadmapCall.path, { method: "POST", headers: roadmapCall.headers, body: roadmapCall.body, role: "member" })).status).toBeGreaterThanOrEqual(400);
  expect((await runtime.fetch("/p/api/roadmap")).status).toBe(200);

  await owner.goto(`/changelog/${draftId}`);
  await owner.getByTestId("delete-entry").click();
  await owner.getByTestId("confirm-delete").click();
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  const deleteEntryCall = calls.pop();
  expect((await runtime.fetch(deleteEntryCall.path, { method: "POST", headers: deleteEntryCall.headers, body: deleteEntryCall.body, role: "member" })).status).toBeGreaterThanOrEqual(400);
  expect(await db.prepare("select count(*) as n from changelog_entries where id = ?").bind(draftId).first()).toMatchObject({ n: 1 });

  // Non-admins see no admin controls.
  await member.goto("/settings");
  await expect(member.getByTestId("board-row").first()).toBeVisible();
  await expect(member.getByTestId("board-create")).toHaveCount(0);
  await expect(member.getByTestId("board-delete")).toHaveCount(0);
  await expect(member.getByTestId("roadmap-public-switch")).toBeDisabled();
  await member.goto(`/changelog/${draftId}`);
  await expect(member.getByTestId("entry-title")).toHaveValue("Secret launch");
  await expect(member.getByTestId("delete-entry")).toHaveCount(0);

  // Public writes don't let a guest act as a member.
  const forged = await postJson(runtime, `/p/api/requests/${id}/comments`, { body: "I am staff", name: "Owner", email: "owner@example.test", internal: true });
  expect(forged.status).toBe(201);
  expect(await db.prepare("select internal, author_user_id from comments where body = 'I am staff'").first()).toMatchObject({ internal: 0, author_user_id: null });
} finally {
  await runtime.close();
}
