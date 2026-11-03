import type { Metadata } from "next";
import Link from "next/link";
import type { Task } from "@/lib/task";
import { createCaller } from "@/server/api/router";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Tasks | Artefact" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function TasksPage() {
  let tasks: Task[];

  try {
    tasks = await createCaller({}).task.list();
  } catch (error) {
    console.error("Failed to load tasks.", error);
    return (
      <main className={styles.page}>
        <Link href="/">Home</Link>
        <h1>Tasks</h1>
        <section className={styles.notice} aria-labelledby="error-title">
          <h2 id="error-title">Tasks could not be loaded</h2>
          <p>Please try again in a moment.</p>
          <a href="/tarefas">Try again</a>
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
        <button type="button" disabled aria-describedby="creation-note">
          New task
        </button>
      </header>
      <p id="creation-note" className={styles.hint}>
        Task creation and editing will be available in the next step.
      </p>

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
                    <button
                      type="button"
                      disabled
                      aria-label={`Edit task: ${task.title}`}
                      aria-describedby="creation-note"
                    >
                      Edit
                    </button>
                  </footer>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
