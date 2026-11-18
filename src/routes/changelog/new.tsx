import { createFileRoute } from "@tanstack/react-router";
import { EntryEditor } from "@/client/components/EntryEditor";
import { getEntryEditor } from "@/serverFunctions/changelog";

export const Route = createFileRoute("/changelog/new")({
  loader: () => getEntryEditor({ data: { id: null } }),
  head: () => ({ meta: [{ title: "New entry · Feedback Board" }] }),
  component: () => <EntryEditor data={Route.useLoaderData()} />,
});
