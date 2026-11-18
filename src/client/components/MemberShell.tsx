import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINKS = [
  { to: "/", label: "Requests" },
  { to: "/roadmap", label: "Roadmap" },
  { to: "/changelog", label: "Changelog" },
  { to: "/settings", label: "Settings" },
] as const;

const LINK = "shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground";

/** The member pages' frame, with links between them. */
export function MemberShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={LINK}
              activeOptions={{ exact: link.to === "/" }}
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}

/** The public pages' frame: boards, roadmap and updates. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-3 overflow-x-auto">
          <Link to="/p" className={LINK} activeOptions={{ exact: true }} activeProps={{ className: "text-foreground font-medium" }}>
            Boards
          </Link>
          <Link to="/p/roadmap" className={LINK} activeProps={{ className: "text-foreground font-medium" }}>
            Roadmap
          </Link>
          <Link to="/p/updates" className={LINK} activeProps={{ className: "text-foreground font-medium" }}>
            Updates
          </Link>
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
