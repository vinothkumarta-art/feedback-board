import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { PublicShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicError, PublicNotFound } from "@/client/components/PublicParts";
import { UpdateBody, type Update } from "@/client/components/UpdateBody";
import { getPublic } from "@/client/lib/publicApi";

export const Route = createFileRoute("/p/updates/")({
  ssr: false,
  loader: () => getPublic<{ entries: Update[] }>("/p/api/updates"),
  head: () => ({ meta: [{ title: "Updates" }] }),
  component: UpdatesPage,
  notFoundComponent: PublicNotFound,
  errorComponent: PublicError,
});

function UpdatesPage() {
  const { entries } = Route.useLoaderData();
  return (
    <PublicShell>
      <PageHeader title="Updates" />
      {entries.length === 0 ? (
        <EmptyState title="No updates yet" />
      ) : (
        <div className="space-y-10">
          {entries.map((entry) => (
            <article key={entry.id} data-testid="update-item" className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Link to="/p/updates/$id" params={{ id: entry.id }} className="hover:underline">
                  {entry.title}
                </Link>
              </h2>
              <UpdateBody entry={entry} />
            </article>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
