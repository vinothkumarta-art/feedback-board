import { createFileRoute } from "@tanstack/react-router";
import { EntryEditor } from "@/client/components/EntryEditor";
import { getEntryEditor } from "@/serverFunctions/changelog";

export const Route = createFileRoute("/changelog/$id")({
  loader: ({ params }) => getEntryEditor({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: loaderData?.entry ? [{ title: `${loaderData.entry.title} · Feedback Board` }] : [],
  }),
  component: EditEntry,
});

function EditEntry() {
  const data = Route.useLoaderData();
  // A fresh editor for each entry, so its fields start from that entry.
  return <EntryEditor key={data.entry?.id} data={data} />;
}
