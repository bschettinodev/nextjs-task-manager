"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isTRPCClientError } from "@trpc/client";
import { taskIdSchema } from "@/lib/task";
import type { Task } from "@/lib/task";
import type { AppRouter } from "@/server/api/router";
import { trpc } from "@/trpc/client";
import styles from "./task-deletion.module.css";

type SelectedTask = Pick<Task, "id" | "title">;
type DeletionError = { message: string; canRefresh: boolean };
type DeletionContextValue = {
  openConfirmation: (task: SelectedTask) => void;
  busy: boolean;
};

const DeletionContext = createContext<DeletionContextValue | null>(null);

export function DeleteTaskButton({ task }: { task: SelectedTask }) {
  const deletion = useContext(DeletionContext);
  if (!deletion) throw new Error("DeleteTaskButton requires TaskDeletion.");

  return (
    <button
      type="button"
      className={styles.destructive}
      disabled={deletion.busy}
      aria-label={`Delete task: ${task.title}`}
      onClick={() => deletion.openConfirmation(task)}
    >
      Delete
    </button>
  );
}

export default function TaskDeletion({ children, initialMessage }: {
  children: ReactNode;
  initialMessage: string;
}) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [error, setError] = useState<DeletionError | null>(null);
  const [message, setMessage] = useState(initialMessage);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const deletionLocked = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const dialogId = useId();
  const busy = deleting || refreshing;

  useEffect(() => {
    if (selectedTask) {
      dialog.current?.showModal();
      cancelButton.current?.focus();
    }
  }, [selectedTask]);

  function openConfirmation(task: SelectedTask) {
    if (deletionLocked.current || refreshing) return;
    setError(null);
    setSelectedTask(task);
  }

  function cancelConfirmation() {
    if (deletionLocked.current) return;
    dialog.current?.close();
    setSelectedTask(null);
    setError(null);
  }

  function refreshList(feedbackMessage: string) {
    dialog.current?.close();
    setSelectedTask(null);
    setError(null);
    setMessage(feedbackMessage);
    // Keep feedback outside the refreshed rows so focus survives removal of a task.
    feedback.current?.focus();
    startRefresh(() => router.refresh());
  }

  async function deleteTask() {
    if (!selectedTask || deletionLocked.current || refreshing) return;
    const input = taskIdSchema.safeParse({ id: selectedTask.id });
    if (!input.success) {
      setError({ message: "This task has an invalid ID. Refresh the list to continue.", canRefresh: true });
      errorMessage.current?.focus();
      return;
    }

    deletionLocked.current = true;
    setDeleting(true);
    setError(null);

    try {
      await trpc.task.delete.mutate(input.data);
    } catch (cause) {
      const code = isTRPCClientError<AppRouter>(cause) ? cause.data?.code : undefined;
      let failure: DeletionError = {
        message: "The task could not be deleted. Check your connection and try again.",
        canRefresh: false,
      };
      if (code === "NOT_FOUND") {
        failure = { message: "This task no longer exists. Refresh the list to continue.", canRefresh: true };
      } else if (code === "BAD_REQUEST") {
        failure = { message: "This task has an invalid ID. Refresh the list to continue.", canRefresh: true };
      }
      setError(failure);
      errorMessage.current?.focus();
      return;
    } finally {
      deletionLocked.current = false;
      setDeleting(false);
    }

    refreshList(`Task deleted: ${selectedTask.title}.`);
  }

  return (
    <DeletionContext.Provider value={{ openConfirmation, busy }}>
      <p ref={feedback} role="status" tabIndex={-1} className={styles.feedback}>
        {message}
      </p>
      <p aria-live="polite" className={styles.progress}>{refreshing ? "Updating the task list…" : ""}</p>
      <noscript>JavaScript is required to delete tasks.</noscript>
      <div inert={refreshing} aria-busy={busy}>{children}</div>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
        aria-busy={deleting}
        onCancel={(event) => { event.preventDefault(); cancelConfirmation(); }}
      >
        <h2 id={`${dialogId}-title`}>Delete task?</h2>
        <p id={`${dialogId}-description`}>
          Delete <strong>{selectedTask?.title}</strong>? This cannot be undone.
        </p>
        <p ref={errorMessage} role="alert" tabIndex={-1} className={styles.error}>{error?.message}</p>
        <p role="status">{deleting ? "Deleting the task…" : ""}</p>
        <div className={styles.actions}>
          <button ref={cancelButton} type="button" disabled={deleting} onClick={cancelConfirmation}>
            Cancel
          </button>
          <button type="button" className={styles.destructive} disabled={deleting} onClick={deleteTask}>
            {deleting ? "Deleting…" : "Delete task"}
          </button>
          {error?.canRefresh && (
            <button type="button" disabled={deleting} onClick={() => refreshList("The task could not be deleted.")}>
              Refresh list
            </button>
          )}
        </div>
      </dialog>
    </DeletionContext.Provider>
  );
}
