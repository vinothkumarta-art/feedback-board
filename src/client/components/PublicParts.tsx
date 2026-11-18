import { useRouter } from "@tanstack/react-router";
import { ChevronUp } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { PublicShell } from "@/client/components/MemberShell";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { errorMessage } from "@/client/lib/format";
import { loadGuest, postPublic, reloadPublic, saveGuest, type Guest, type Viewer } from "@/client/lib/publicApi";

export function PublicNotFound() {
  return (
    <PublicShell>
      <div data-testid="not-found">
        <EmptyState kind="filtered" title="Page not found" />
      </div>
    </PublicShell>
  );
}

export function PublicError({ error }: { error: unknown }) {
  return (
    <PublicShell>
      <EmptyState kind="error" title="Couldn't load this page" description={errorMessage(error)} />
    </PublicShell>
  );
}

/** Name and email for a visitor who isn't signed in, remembered in this browser. */
export function GuestFields({ guest, onChange }: { guest: Guest; onChange: (guest: Guest) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="guest-name">Your name</Label>
        <Input id="guest-name" data-testid="guest-name" value={guest.name} required onChange={(e) => onChange({ ...guest, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest-email">Your email</Label>
        <Input
          id="guest-email"
          data-testid="guest-email"
          type="email"
          value={guest.email}
          required
          onChange={(e) => onChange({ ...guest, email: e.target.value })}
        />
      </div>
    </div>
  );
}

export function useGuest() {
  const [guest, setGuest] = useState<Guest>(() => loadGuest() ?? { name: "", email: "" });
  return { guest, setGuest };
}

/** Votes, or takes the vote back. A visitor gives their name and email first. */
export function VoteButton({
  requestId,
  votes,
  voted,
  viewer,
}: {
  requestId: string;
  votes: number;
  voted: boolean;
  viewer: Viewer;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest>({ name: "", email: "" });

  async function vote(as: Guest | null) {
    setPending(true);
    setError(null);
    try {
      await postPublic(`/p/api/requests/${requestId}/vote`, as ?? {});
      if (as) saveGuest(as);
      setAsking(false);
      await reloadPublic(router);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant={voted ? "secondary" : "outline"}
        className="h-auto w-14 shrink-0 flex-col gap-0 py-1.5"
        data-testid="vote-button"
        aria-label="Vote"
        aria-pressed={voted}
        disabled={pending}
        onClick={() => {
          if (viewer.member) return void vote(null);
          const known = loadGuest();
          if (known) return void vote(known);
          setAsking(true);
        }}
      >
        <ChevronUp aria-hidden />
        <span data-testid="vote-count" className="font-semibold">
          {votes}
        </span>
      </Button>
      {asking ? (
        <Dialog open onOpenChange={(open) => !open && !pending && setAsking(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vote</DialogTitle>
            </DialogHeader>
            <form
              id={`vote-${requestId}`}
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void vote(guest);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="vote-name">Your name</Label>
                <Input id="vote-name" data-testid="vote-name" value={guest.name} required onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote-email">Your email</Label>
                <Input
                  id="vote-email"
                  data-testid="vote-email"
                  type="email"
                  value={guest.email}
                  required
                  onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </form>
            <DialogFooter>
              <Button type="submit" form={`vote-${requestId}`} data-testid="vote-confirm" pending={pending}>
                Vote
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}
    </>
  );
}
