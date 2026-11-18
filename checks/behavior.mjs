// Behavior: every frozen feature's main path, request-level checks on the
// public routes, one browser journey and a phone-sized smoke.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createBoard, getJson, guestPost, pick, postJson, waitFor } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  const guest = await (await runtime.context(null)).newPage();
  const db = await runtime.database();

  // F001: boards. Admin creates, renames and deletes.
  await createBoard(owner, { name: "Product ideas", slug: "ideas", description: "What should we build next?" });
  await createBoard(owner, { name: "Mobile", slug: "mobile", description: "The phone experience" });
  await createBoard(owner, { name: "Scratch", slug: "scratch", description: "Temporary" });
  const scratch = owner.getByTestId("board-row").filter({ hasText: "Scratch" });
  await scratch.getByTestId("board-rename").click();
  await owner.getByTestId("rename-name").fill("Integrations");
  await owner.getByTestId("rename-save").click();
  const renamed = owner.getByTestId("board-row").filter({ hasText: "Integrations" });
  await expect(renamed).toBeVisible();
  await renamed.getByTestId("board-delete").click();
  await owner.getByTestId("confirm-delete").click();
  await expect(owner.getByTestId("board-row").filter({ hasText: "Integrations" })).toHaveCount(0);
  expect((await runtime.fetch("/p/api/boards/scratch")).status).toBe(404);
  const boards = await getJson(runtime, "/p/api/boards");
  expect(boards.boards.map((b) => b.slug).sort()).toEqual(["ideas", "mobile"]);

  // F001: a guest posts on the public board page.
  await guest.goto("/p/b/ideas");
  await expect(guest.getByRole("heading", { name: "Product ideas" })).toBeVisible();
  await guest.getByTestId("post-title").fill("Export reports to CSV");
  await guest.getByTestId("post-description").fill("Our finance team needs the monthly numbers in a spreadsheet.");
  await guest.getByTestId("guest-name").fill("Ana Lima");
  await guest.getByTestId("guest-email").fill("ana@northwind.example");
  await guest.getByTestId("post-submit").click();
  await expect(guest.getByTestId("request-item").filter({ hasText: "Export reports to CSV" })).toBeVisible();

  // Similar requests show while typing a title.
  await guest.getByTestId("post-title").fill("CSV export for invoices");
  await expect(guest.getByTestId("similar-requests")).toContainText("Export reports to CSV");

  // More requests through the public API.
  const darkId = await guestPost(runtime, "ideas", { title: "Dark mode", description: "Easier on the eyes at night.", name: "Ben Ode", email: "ben@contoso.example" });
  const ssoId = await guestPost(runtime, "ideas", { title: "Slack alerts for new replies", name: "Cy Park", email: "cy@fabrikam.example" });
  let list = await getJson(runtime, "/p/api/boards/ideas?sort=newest");
  const csv = list.requests.find((r) => r.title === "Export reports to CSV");
  expect(csv.status).toBe("pending");
  expect(list.requests[0].title).toBe("Slack alerts for new replies");
  expect(JSON.stringify(list)).not.toContain("@");
  const similar = await getJson(runtime, `/p/api/boards/ideas/similar?q=${encodeURIComponent("dark theme")}`);
  expect(similar.requests.map((r) => r.title)).toContain("Dark mode");
  expect((await postJson(runtime, "/p/api/boards/ideas/requests", { title: "", name: "X", email: "x@y.example" })).status).toBe(400);
  expect((await postJson(runtime, "/p/api/boards/ideas/requests", { title: "No email", name: "X", email: "nope" })).status).toBe(400);

  // F002: one vote per person, toggled; guests keyed by normalized email.
  let vote = await (await postJson(runtime, `/p/api/requests/${darkId}/vote`, { name: "Dee", email: " Dee@Globex.example " })).json();
  expect(vote).toMatchObject({ voted: true, votes: 1 });
  vote = await (await postJson(runtime, `/p/api/requests/${darkId}/vote`, { name: "Dee", email: "dee@globex.example" })).json();
  expect(vote).toMatchObject({ voted: false, votes: 0 });
  await postJson(runtime, `/p/api/requests/${darkId}/vote`, { name: "Dee", email: "dee@globex.example" });
  await postJson(runtime, `/p/api/requests/${darkId}/vote`, { name: "Eve", email: "eve@initech.example" });
  // A member votes on the public route, keyed by their user id.
  vote = await (await postJson(runtime, `/p/api/requests/${darkId}/vote`, {}, "member")).json();
  expect(vote).toMatchObject({ voted: true, votes: 3 });
  list = await getJson(runtime, "/p/api/boards/ideas");
  expect(list.requests[0].title).toBe("Dark mode");
  expect(list.requests[0].votes).toBe(3);
  const searched = await getJson(runtime, "/p/api/boards/ideas?q=slack");
  expect(searched.requests.map((r) => r.title)).toEqual(["Slack alerts for new replies"]);

  // Guest votes in the browser after the page remembers them.
  await guest.goto("/p/b/ideas");
  const csvItem = guest.getByTestId("request-item").filter({ hasText: "Export reports to CSV" });
  await csvItem.getByTestId("vote-button").click();
  await expect(csvItem.getByTestId("vote-count")).toHaveText("1");

  // Guest comment on the public request page.
  await guest.goto(`/p/r/${darkId}`);
  await expect(guest.getByRole("heading", { name: "Dark mode" })).toBeVisible();
  await guest.getByTestId("comment-input").fill("Would love this for the editor too.");
  await guest.getByTestId("comment-submit").click();
  await expect(guest.getByTestId("comment").filter({ hasText: "Would love this for the editor too." })).toBeVisible();

  // F001: member dashboard, posting for a customer.
  await member.goto("/");
  await expect(member.getByTestId("request-row").filter({ hasText: "Dark mode" })).toBeVisible();
  await member.getByTestId("new-request").click();
  await pick(member, "nr-board", "Mobile");
  await member.getByTestId("nr-title").fill("Offline mode on phones");
  await member.getByTestId("nr-description").fill("Field staff lose signal in warehouses.");
  await member.getByTestId("nr-name").fill("Gus Hale");
  await member.getByTestId("nr-email").fill("gus@tailspin.example");
  await member.getByTestId("nr-submit").click();
  await expect(member.getByTestId("request-row").filter({ hasText: "Offline mode on phones" })).toBeVisible();
  const onBehalf = await db.prepare("select source, author_email, author_user_id from requests where title = ?").bind("Offline mode on phones").first();
  expect(onBehalf).toMatchObject({ source: "on_behalf", author_email: "gus@tailspin.example", author_user_id: null });

  // F002: member adds a vote for a customer, deduped by email.
  await member.goto(`/requests/${darkId}`);
  await expect(member.getByTestId("vote-count")).toHaveText("3");
  await member.getByTestId("onbehalf-name").fill("Eve");
  await member.getByTestId("onbehalf-email").fill("EVE@initech.example");
  await member.getByTestId("onbehalf-vote").click();
  await expect(member.getByTestId("onbehalf-email")).toHaveValue("");
  await expect(member.getByTestId("vote-count")).toHaveText("3");
  await member.getByTestId("onbehalf-name").fill("Hal");
  await member.getByTestId("onbehalf-email").fill("hal@umbrella.example");
  await member.getByTestId("onbehalf-vote").click();
  await expect(member.getByTestId("vote-count")).toHaveText("4");

  // Internal comment: members see it, public routes never return it.
  await member.getByTestId("comment-input").fill("Design has a palette ready, ship with the next release.");
  await member.getByTestId("comment-internal").click();
  await member.getByTestId("comment-submit").click();
  await expect(member.getByTestId("comment").filter({ hasText: "palette ready" })).toContainText("Internal");
  await expect(member.getByTestId("comment").filter({ hasText: "editor too" })).toBeVisible();
  const publicRequest = await getJson(runtime, `/p/api/requests/${darkId}`);
  expect(JSON.stringify(publicRequest)).not.toContain("palette ready");
  expect(publicRequest.comments.map((c) => c.body)).toContain("Would love this for the editor too.");
  // The member edits their own comment.
  const mine = member.getByTestId("comment").filter({ hasText: "palette ready" });
  await mine.getByTestId("comment-edit").click();
  await member.getByTestId("comment-edit-input").fill("Design has a palette ready for this.");
  await member.getByTestId("comment-edit-save").click();
  await expect(member.getByTestId("comment").filter({ hasText: "palette ready for this." })).toBeVisible();

  // Follow and unfollow.
  await expect(member.getByTestId("follow-button")).toHaveText(/Following/);
  await member.getByTestId("follow-button").click();
  await expect(member.getByTestId("follow-button")).toHaveText(/^Follow$/);
  await member.getByTestId("follow-button").click();
  await expect(member.getByTestId("follow-button")).toHaveText(/Following/);

  // F003: status change, timeline, and notifications to every subscriber but the actor.
  await pick(member, "status-select", "Planned");
  await expect(member.getByTestId("timeline-event").filter({ hasText: "Planned" })).toBeVisible();
  expect((await getJson(runtime, `/p/api/requests/${darkId}`)).request.status).toBe("planned");
  let mails = [];
  await waitFor(async () => {
    mails = (await runtime.gatewayCalls()).filter((c) => c.body && c.body.includes("Dark mode"));
    return mails.length >= 4;
  }, "status emails");
  const recipients = mails.map((c) => c.body).join("\n");
  for (const email of ["ben@contoso.example", "dee@globex.example", "eve@initech.example", "hal@umbrella.example"]) expect(recipients).toContain(email);
  expect(recipients).not.toContain("member@example.test");
  expect(recipients).toContain("/p/unsubscribe/");
  expect(recipients).toContain(runtime.hostname);
  // The page survives the Gateway refusing mail.
  await expect(member.getByTestId("request-title")).toHaveText("Dark mode");

  // One-click unsubscribe.
  const sub = await db.prepare("select token from subscriptions where email = ? and request_id = ?").bind("ben@contoso.example", darkId).first();
  await guest.goto(`/p/unsubscribe/${sub.token}`);
  await expect(guest.getByTestId("unsubscribed")).toBeVisible();
  expect(await db.prepare("select count(*) as n from subscriptions where token = ?").bind(sub.token).first()).toMatchObject({ n: 0 });

  // F004: public roadmap and moving cards.
  let roadmap = await getJson(runtime, "/p/api/roadmap");
  expect(roadmap.columns.planned.map((r) => r.title)).toContain("Dark mode");
  await member.goto("/roadmap");
  const card = member.getByTestId("column-planned").getByTestId("roadmap-card").filter({ hasText: "Dark mode" });
  await expect(card).toContainText("Product ideas");
  await card.getByTestId("card-status").click();
  await member.getByRole("option", { name: "In Progress", exact: true }).click();
  await expect(member.getByTestId("column-in_progress").getByTestId("roadmap-card").filter({ hasText: "Dark mode" })).toBeVisible();
  roadmap = await getJson(runtime, "/p/api/roadmap?board=mobile");
  expect(roadmap.columns.in_progress).toEqual([]);
  await guest.goto("/p/roadmap");
  const publicCard = guest.getByTestId("column-in_progress").getByTestId("roadmap-card").filter({ hasText: "Dark mode" });
  await expect(publicCard.getByTestId("vote-count")).toHaveText("4");
  await publicCard.getByTestId("vote-button").click();
  await expect(publicCard.getByTestId("vote-count")).toHaveText("5");
  // Admin switches the public roadmap off, then on.
  await owner.goto("/settings");
  await owner.getByTestId("roadmap-public-switch").click();
  await expect(owner.getByTestId("roadmap-public-switch")).toHaveAttribute("aria-checked", "false");
  expect((await runtime.fetch("/p/api/roadmap")).status).toBe(404);
  await guest.goto("/p/roadmap");
  await expect(guest.getByTestId("not-found")).toBeVisible();
  await owner.getByTestId("roadmap-public-switch").click();
  await expect(owner.getByTestId("roadmap-public-switch")).toHaveAttribute("aria-checked", "true");
  expect((await runtime.fetch("/p/api/roadmap")).status).toBe(200);

  // F003: merge a duplicate; votes dedupe, comments and the link move.
  const dupId = await guestPost(runtime, "ideas", { title: "Night theme please", name: "Ivy", email: "ivy@hooli.example" });
  await postJson(runtime, `/p/api/requests/${dupId}/vote`, { name: "Eve", email: "eve@initech.example" });
  await postJson(runtime, `/p/api/requests/${dupId}/vote`, { name: "Ivy", email: "ivy@hooli.example" });
  await postJson(runtime, `/p/api/requests/${dupId}/comments`, { body: "Dark UI would help with migraines.", name: "Ivy", email: "ivy@hooli.example" });
  await owner.goto(`/requests/${dupId}`);
  await owner.getByTestId("merge-button").click();
  await pick(owner, "merge-target", "Dark mode");
  await owner.getByTestId("merge-confirm").click();
  await owner.waitForURL(`**/requests/${darkId}`);
  await expect(owner.getByTestId("vote-count")).toHaveText("6");
  await expect(owner.getByTestId("comment").filter({ hasText: "migraines" })).toBeVisible();
  const merged = await getJson(runtime, `/p/api/requests/${dupId}`);
  expect(merged.mergedInto).toBe(darkId);
  expect((await getJson(runtime, "/p/api/boards/ideas")).requests.map((r) => r.title)).not.toContain("Night theme please");
  await guest.goto(`/p/r/${dupId}`);
  await guest.waitForURL(`**/p/r/${darkId}`);
  await expect(guest.getByRole("heading", { name: "Dark mode" })).toBeVisible();
  expect(await db.prepare("select count(*) as n from subscriptions where request_id = ? and email = ?").bind(darkId, "ivy@hooli.example").first()).toMatchObject({ n: 1 });

  // F001: admin deletes a request.
  const spamId = await guestPost(runtime, "mobile", { title: "Buy cheap watches", name: "Spam", email: "spam@spam.example" });
  await owner.goto(`/requests/${spamId}`);
  await owner.getByTestId("delete-request").click();
  await owner.getByTestId("confirm-delete").click();
  await owner.waitForURL((url) => url.pathname === "/");
  expect((await runtime.fetch(`/p/api/requests/${spamId}`)).status).toBe(404);

  // F005: changelog drafts, publishing, scheduling.
  await member.goto("/changelog");
  await member.getByTestId("new-entry").click();
  await member.getByTestId("entry-title").fill("Dark mode is here");
  await member.getByTestId("entry-body").fill("## Easier on the eyes\n\nSwitch themes from the **top bar**.\n\n- Follows your system\n- Remembers your pick");
  await pick(member, "entry-tag", "Improvement");
  await member.getByTestId("linked-requests").getByLabel("Dark mode").check();
  await member.getByTestId("save-draft").click();
  await expect(member.getByTestId("entry-state")).toHaveText("Draft");
  const entryId = new URL(member.url()).pathname.split("/").pop();
  expect((await getJson(runtime, "/p/api/updates")).entries).toEqual([]);
  expect((await runtime.fetch(`/p/api/updates/${entryId}`)).status).toBe(404);
  await member.getByTestId("publish-now").click();
  await expect(member.getByTestId("entry-state")).toHaveText("Published");
  let updates = await getJson(runtime, "/p/api/updates");
  expect(updates.entries.map((e) => e.title)).toEqual(["Dark mode is here"]);
  expect(updates.entries[0].tag).toBe("Improvement");

  // A scheduled entry with a custom tag stays hidden until its time.
  await member.goto("/changelog/new");
  await member.getByTestId("entry-title").fill("Faster search");
  await member.getByTestId("entry-body").fill("Search results now load in half the time.");
  await pick(member, "entry-tag", "Custom");
  await member.getByTestId("entry-custom-tag").fill("Performance");
  await member.getByTestId("schedule-at").fill("2031-03-01T09:00");
  await member.getByTestId("schedule").click();
  await expect(member.getByTestId("entry-state")).toHaveText("Scheduled");
  const scheduledId = new URL(member.url()).pathname.split("/").pop();
  expect((await getJson(runtime, "/p/api/updates")).entries.map((e) => e.title)).not.toContain("Faster search");
  await db.prepare("update changelog_entries set publish_at = ? where id = ?").bind("2020-01-01T00:00:00.000Z", scheduledId).run();
  updates = await getJson(runtime, "/p/api/updates");
  expect(updates.entries.map((e) => e.title)).toEqual(["Dark mode is here", "Faster search"]);
  expect(updates.entries[1].tag).toBe("Performance");

  await guest.goto("/p/updates");
  await guest.getByTestId("update-item").filter({ hasText: "Dark mode is here" }).getByRole("link", { name: "Dark mode is here" }).click();
  await guest.waitForURL(`**/p/updates/${entryId}`);
  await expect(guest.getByRole("heading", { name: "Easier on the eyes" })).toBeVisible();
  await expect(guest.locator("strong", { hasText: "top bar" })).toBeVisible();
  await expect(guest.getByTestId("linked-request").filter({ hasText: "Dark mode" })).toContainText("6");

  // Unpublish hides it again.
  await member.goto(`/changelog/${scheduledId}`);
  await member.getByTestId("unpublish").click();
  await expect(member.getByTestId("entry-state")).toHaveText("Draft");
  expect((await getJson(runtime, "/p/api/updates")).entries.map((e) => e.title)).toEqual(["Dark mode is here"]);

  // Browser journey: a team triages feedback in the dashboard.
  await guestPost(runtime, "ideas", { title: "Two-factor sign-in for customers", name: "Jo", email: "jo@acme.example" });
  await guestPost(runtime, "mobile", { title: "Push notifications for replies", name: "Kai", email: "kai@acme.example" });
  await owner.goto("/");
  await runtime.assertBackLink(owner);
  await owner.getByTestId("request-row").filter({ hasText: "Export reports to CSV" }).getByRole("link").click();
  await owner.waitForURL(/\/requests\//);
  await pick(owner, "status-select", "In Review");
  await expect(owner.getByTestId("timeline-event").filter({ hasText: "In Review" })).toBeVisible();
  await owner.goto("/");
  await expect(owner.getByTestId("request-row").filter({ hasText: "Export reports to CSV" })).toContainText("In Review");
  await expect(owner.getByTestId("request-row")).toHaveCount(6);
  await runtime.screenshot(owner);

  // Phone-sized smoke.
  const phone = await (await runtime.context(null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/p/b/ideas");
  await expect(phone.getByTestId("request-item").first()).toBeVisible();
  await expect(phone.getByTestId("post-title")).toBeVisible();
  const memberPhone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await memberPhone.goto("/");
  await expect(memberPhone.getByTestId("request-row").first()).toBeVisible();
} finally {
  await runtime.close();
}
