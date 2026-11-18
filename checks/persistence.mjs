// Persistence: what people write survives a restart of the Workers.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createBoard, getJson, guestPost, postJson } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const owner = await (await runtime.context("owner")).newPage();
  await createBoard(owner, { name: "Ideas", slug: "ideas", description: "Requests" });
  const id = await guestPost(runtime, "ideas", { title: "Bulk edit tags", description: "Select many at once", name: "Lou", email: "lou@example.org" });
  await postJson(runtime, `/p/api/requests/${id}/vote`, { name: "Max", email: "max@example.org" });
  await postJson(runtime, `/p/api/requests/${id}/comments`, { body: "Same need here.", name: "Max", email: "max@example.org" });
  await owner.goto("/changelog/new");
  await owner.getByTestId("entry-title").fill("Tag editing");
  await owner.getByTestId("entry-body").fill("You can now edit tags in bulk.");
  await owner.getByTestId("publish-now").click();
  await expect(owner.getByTestId("entry-state")).toHaveText("Published");

  await runtime.restart();

  const request = await getJson(runtime, `/p/api/requests/${id}`);
  expect(request.request).toMatchObject({ title: "Bulk edit tags", votes: 1, status: "pending" });
  expect(request.comments.map((c) => c.body)).toEqual(["Same need here."]);
  expect((await getJson(runtime, "/p/api/boards")).boards.map((b) => b.name)).toEqual(["Ideas"]);
  expect((await getJson(runtime, "/p/api/updates")).entries.map((e) => e.title)).toEqual(["Tag editing"]);
  const page = await (await runtime.context("member")).newPage();
  await page.goto("/");
  await expect(page.getByTestId("request-row").filter({ hasText: "Bulk edit tags" })).toBeVisible();
} finally {
  await runtime.close();
}
