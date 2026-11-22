import { CreateSecret } from "@/components/create-secret";

export default function Home() {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Share a secret</h1>
        <p className="text-sm text-muted-foreground">
          Get a link that works once. After it&apos;s opened, the secret is gone.
        </p>
      </header>
      <CreateSecret />
    </>
  );
}
