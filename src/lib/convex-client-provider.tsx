"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl && typeof window !== "undefined") {
  // Only warn in the browser — during `next build` this module still gets
  // evaluated for static prerendering, before .env.local / Convex exist yet.
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL is not set — copy .env.example to .env.local and run `npx convex dev`. Convex-backed screens won't work until then.",
  );
}

// Falls back to a syntactically-valid placeholder so the client can always be
// constructed (build-time prerendering, or before Convex is connected). Real
// queries/mutations will simply fail until a real URL is provided.
const convex = new ConvexReactClient(convexUrl || "https://placeholder.convex.cloud");

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
