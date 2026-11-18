# Feedback Board

Customers post feature requests on public boards and vote on them; your team triages them, shares a public roadmap and publishes a changelog.

Inspired by https://userjot.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Post requests to public boards as a guest or member, with similar requests shown while typing.
- Vote once per person, comment, keep internal team notes and follow requests.
- Change a request's status, notify its followers by email, and merge duplicates.
- Share a public roadmap of planned, in-progress and completed requests.
- Write, schedule and publish changelog entries linked to the requests they answer.

Left out: accounts and sign-in, which your Gateway handles; live chat, AI assistants, the embeddable widget, private boards, custom domains, integrations and importers, and native apps.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test` for unit tests; `checks/` holds the release suites run against a packaged build.
- Deploy: `pnpm run deploy`, then share `https://<app address>/p` with customers.

No secrets or settings. Status emails are optional: they go out once the Gateway's email is set up (`everyapp email`), and are skipped until then.

## Limitations

- Guests are identified by the email they type; nothing verifies it.
- Status emails need email set up on your Gateway; they were not sent during local checks.
- Public pages are drawn in the browser, so they need JavaScript.
