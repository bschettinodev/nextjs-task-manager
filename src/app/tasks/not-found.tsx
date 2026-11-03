import Link from "next/link";

export default function TaskNotFound() {
  return (
    <main>
      <h1>Task not found</h1>
      <p>This task does not exist or is no longer available.</p>
      <Link href="/tasks">Back to tasks</Link>
    </main>
  );
}
