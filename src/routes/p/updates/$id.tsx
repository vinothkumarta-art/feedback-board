import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PublicShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicError, PublicNotFound } from "@/client/components/PublicParts";
import { UpdateBody, type Update } from "@/client/components/UpdateBody";
import { getPublic } from "@/client/lib/publicApi";

export const Route = createFileRoute("/p/updates/$id")({
  ssr: false,
  loader: ({ params }) => getPublic<{ entry: Update }>(`/p/api/updates/${encodeURIComponent(params.id)}`),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.entry.title }] : [] }),
  component: UpdatePage,
  notFoundComponent: PublicNotFound,
  errorComponent: PublicError,
});

function UpdatePage() {
  const { entry } = Route.useLoaderData();
  return (
    <PublicShell>
      <PageHeader
        backLink={
          <Link to="/p/updates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Updates
          </Link>
        }
        title={entry.title}
      />
      <UpdateBody entry={entry} />
    </PublicShell>
  );
}
