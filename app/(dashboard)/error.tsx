"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <p className="text-sm text-wm-red">Something went wrong: {error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-wm-accent px-3 py-2 text-sm text-white"
      >
        Try again
      </button>
    </div>
  );
}