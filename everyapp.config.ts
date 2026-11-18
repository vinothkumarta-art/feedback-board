import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "feedback-board",
  name: "Feedback Board",
  description:
    "Collect feature requests from customers, let them vote, and share a public roadmap and changelog.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
  },
  // Every member manages feedback; owners and admins manage boards and settings.
  access: "everyone",
  capabilities: {
    email: {
      access: "write",
      why: "Emails subscribers when a request's status changes.",
    },
  },
  features: {
    email: {
      name: "Status emails",
      why: "Emails everyone following a request when its status changes.",
      capabilities: ["email"],
    },
  },
  // Customers who aren't members use the public board, request, roadmap and
  // changelog pages (/p/...), their data and actions (/p/api/...), and the
  // unsubscribe link in status emails. Each route checks what it must itself.
  public: [
    { path: "/p/**", methods: ["GET"] },
    { path: "/p/api/**", methods: ["POST"] },
  ],
  // The built scripts and styles the public pages load, and the icon.
  publicAssets: ["/assets/**", "/icon.svg"],
});
