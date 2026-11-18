import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { MemberShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { formatDateTime } from "@/client/lib/format";
import { getChangelog } from "@/serverFunctions/changelog";

export const Route = createFileRoute("/changelog/")({
  loader: () => getChangelog(),
  head: () => ({ meta: [{ title: "Changelog · Feedback Board" }] }),
  component: ChangelogPage,
});

const STATE_LABEL = { draft: "Draft", scheduled: "Scheduled", published: "Published" } as const;

function ChangelogPage() {
  const entries = Route.useLoaderData();
  return (
    <MemberShell>
      <PageHeader
        title="Changelog"
        actions={
          <Button data-testid="new-entry" nativeButton={false} render={<Link to="/changelog/new" />}>
            <Plus aria-hidden />
            New entry
          </Button>
        }
      />
      {entries.length === 0 ? (
        <EmptyState title="No entries yet" description="Write one and publish it to the public updates page." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {entries.map((entry) => (
            <li key={entry.id} data-testid="entry-row" className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link to="/changelog/$id" params={{ id: entry.id }} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {entry.title}
              </Link>
              <Badge variant="outline">{entry.tag}</Badge>
              <Badge variant={entry.state === "published" ? "default" : "secondary"}>{STATE_LABEL[entry.state]}</Badge>
              {entry.publishAt ? (
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.publishAt)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </MemberShell>
  );
}
