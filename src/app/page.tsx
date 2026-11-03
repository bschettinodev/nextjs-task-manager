import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Task Manager</h1>
      <p>A simple place to keep track of your tasks.</p>
      <Link href="/tasks">View tasks</Link>
    </main>
  );
}
