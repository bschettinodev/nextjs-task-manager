import { createCaller } from "@/server/api/router";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  const health = await createCaller({}).health();

  return (
    <main>
      <h1>Task Manager</h1>
      <p>A simple place to keep track of your tasks.</p>
      <p>Backend connection: <strong>{health.status}</strong></p>
      <Link href="/tarefas">View tasks</Link>
    </main>
  );
}
