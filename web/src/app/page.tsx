import Link from "next/link";
import { ServerStatus } from "@/components/ServerStatus";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Rehearse</h1>
      <p className="text-muted">
        Practice LeetCode-style interviews out loud with an AI interviewer that can see your code.
      </p>
      <Link
        href="/practice"
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:brightness-110"
      >
        Start a mock interview
      </Link>
      <Link href="/report/demo" className="self-start text-sm text-accent hover:underline">
        See a sample report
      </Link>
      <ServerStatus />
    </main>
  );
}
