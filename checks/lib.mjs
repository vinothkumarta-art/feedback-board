// Shared helpers for the release suites.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export const json = (body) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function getJson(runtime, path, role) {
  const response = await runtime.fetch(path, role ? { role } : {});
  expect(response.status, path).toBe(200);
  return response.json();
}

export async function postJson(runtime, path, body, role) {
  return runtime.fetch(path, { ...json(body), ...(role ? { role } : {}) });
}

/** Opens a Base UI select by its test id and picks the option by its label. */
export async function pick(page, testId, option) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

/** Makes a board as the owner through the settings page. */
export async function createBoard(page, { name, slug, description }) {
  await page.goto("/settings");
  await page.getByTestId("board-name").fill(name);
  await page.getByTestId("board-slug").fill(slug);
  await page.getByTestId("board-description").fill(description);
  await page.getByTestId("board-create").click();
  await expect(page.getByTestId("board-row").filter({ hasText: name })).toBeVisible();
}

/** Posts a request as a guest through the public API and returns its id. */
export async function guestPost(runtime, slug, { title, description = "", name, email }) {
  const response = await postJson(runtime, `/p/api/boards/${slug}/requests`, { title, description, name, email });
  expect(response.status, `post ${title}`).toBe(201);
  return (await response.json()).id;
}

/**
 * Records the server-function calls a page makes. With `block`, the calls are
 * aborted so they never run: the suite replays them as another role.
 */
export async function recordServerCalls(page, { block = false } = {}) {
  const calls = [];
  await page.route("**/_serverFn/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const headers = Object.fromEntries(
        Object.entries(request.headers()).filter(([name]) => name === "content-type" || name.startsWith("x-")),
      );
      calls.push({ path: new URL(request.url()).pathname + new URL(request.url()).search, headers, body: request.postData() });
      if (block) return route.abort();
    }
    return route.continue();
  });
  return calls;
}

export async function waitFor(check, what, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${what}`);
}
