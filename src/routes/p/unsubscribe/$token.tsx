import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/client/components/MemberShell";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicError, PublicNotFound } from "@/client/components/PublicParts";
import { postPublic } from "@/client/lib/publicApi";
import { notFound } from "@tanstack/react-router";

// The link in a status email: opening it stops that request's emails.
export const Route = createFileRoute("/p/unsubscribe/$token")({
  ssr: false,
  loader: async ({ params }) => {
    try {
      return await postPublic<{ ok: true }>(`/p/api/unsubscribe/${encodeURIComponent(params.token)}`, {});
    } catch {
      throw notFound();
    }
  },
  component: Unsubscribed,
  notFoundComponent: PublicNotFound,
  errorComponent: PublicError,
});

function Unsubscribed() {
  return (
    <PublicShell>
      <div data-testid="unsubscribed">
        <PageHeader title="Unsubscribed" description="You won't get more emails about this request." />
      </div>
    </PublicShell>
  );
}
