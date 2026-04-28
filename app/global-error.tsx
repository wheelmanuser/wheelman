"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-wm-bg text-wm-text">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-6">
          <div className="w-full rounded-xl border border-wm-border bg-wm-s1 p-6">
            <h2 className="text-xl font-semibold">Something went wrong.</h2>
            <p className="mt-2 text-sm text-wm-text2">
              The error was captured for debugging.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-4 rounded-md bg-wm-accent px-4 py-2 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
