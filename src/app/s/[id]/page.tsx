import type { Metadata } from "next";
import { RevealSecret } from "@/components/reveal-secret";

// Generic title, no OpenGraph: link previews should show nothing useful.
export const metadata: Metadata = {
  title: "Secrets",
  robots: { index: false, follow: false },
};

export default async function SecretPage({ params }: PageProps<"/s/[id]">) {
  const { id } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Someone shared a secret with you</h1>
      <RevealSecret id={id} />
    </>
  );
}
