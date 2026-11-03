import type { Metadata } from "next";
import Link from "next/link";
import type { Task } from "@/lib/task";
import { createCaller } from "@/server/api/router";
import TaskDeletion, { DeleteTaskButton } from "./task-deletion";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Tasks | Artefact" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function TasksPage({ searchParams }: {
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const { saved } = await searchParams;
  let initialMessage = "";
  if (saved === "created") initialMessage = "Task created successfully.";
  if (saved === "updated") initialMessage = "Task updated successfully.";
  let tasks: Task[];

  try {
    tasks = await createCaller({}).task.list();
  } catch {
    console.error("Failed to load tasks.");
    return (
      <main className={styles.page}>
        <Link href="/">Home</Link>
        <h1>Tasks</h1>
        <section className={styles.notice} aria-labelledby="error-title">
          <h2 id="error-title">Tasks could not be loaded</h2>
          <p>Please try again in a moment.</p>
          <a href="/tasks">Try again</a>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Link href="/">Home</Link>
      <header className={styles.header}>
        <div>
          <h1>Tasks</h1>
          <p>Keep your work in view, one task at a time.</p>
        </div>
        <Link href="/tasks/new" className={styles.action}>
          New task
        </Link>
      </header>
      <TaskDeletion initialMessage={initialMessage}>
        {tasks.length === 0 ? (
          <section className={styles.notice} aria-labelledby="empty-title">
            <h2 id="empty-title">No tasks yet</h2>
            <p>Your tasks will appear here once they are created.</p>
          </section>
        ) : (
          <section aria-label="Task list">
            <p className={styles.hint}>
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </p>
            <ul className={styles.list}>
              {tasks.map((task) => (
                <li key={task.id} className={styles.card}>
                  <article>
                    <h2>{task.title}</h2>
                    {task.description && (
                      <p className={styles.description}>{task.description}</p>
                    )}
                    <footer className={styles.footer}>
                      <p className={styles.hint}>
                        Created <time dateTime={new Date(task.createdAt).toISOString()}>
                          {dateFormatter.format(task.createdAt)} UTC
                        </time>
                      </p>
                      <div className={styles.actions}>
                        <Link
                          href={`/tasks/${task.id}/edit`}
                          className={styles.action}
                          aria-label={`Edit task: ${task.title}`}
                        >
                          Edit
                        </Link>
                        <DeleteTaskButton task={{ id: task.id, title: task.title }} />
                      </div>
                    </footer>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}
      </TaskDeletion>
    </main>
  );
}
