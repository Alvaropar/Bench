import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-20">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm leading-relaxed text-muted">
        This app does not exist, or it is private and belongs to someone else.
      </p>
      <Link
        href="/"
        className="w-fit rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
      >
        Back to Bench
      </Link>
    </main>
  );
}
