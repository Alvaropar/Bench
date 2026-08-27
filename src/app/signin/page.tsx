import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const { mode } = await searchParams;

  // Already signed in: there is nothing to do on this page.
  const viewer = await getViewer().catch(() => null);
  if (viewer?.user) redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Bench
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <AuthForm initialMode={mode === "register" ? "register" : "signin"} />
      </main>
    </div>
  );
}
