"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isTRPCClientError } from "@trpc/client";
import { z } from "zod";
import { taskFieldsSchema } from "@/lib/task";
import type { Task } from "@/lib/task";
import type { AppRouter } from "@/server/api/router";
import { trpc } from "@/trpc/client";
import styles from "./task-form.module.css";

type FieldErrors = Partial<Record<"title" | "description", string>>;

export default function TaskForm({ task }: { task?: Task }) {
  const router = useRouter();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const submissionLocked = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const descriptionInput = useRef<HTMLTextAreaElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const busy = status !== "idle";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLocked.current) return;

    setError("");
    const result = taskFieldsSchema.safeParse({
      title,
      description: description === "" ? undefined : description,
    });

    if (!result.success) {
      const errors = z.flattenError(result.error).fieldErrors;
      setFieldErrors({ title: errors.title?.[0], description: errors.description?.[0] });
      if (errors.title) titleInput.current?.focus();
      else descriptionInput.current?.focus();
      return;
    }

    setFieldErrors({});
    submissionLocked.current = true;
    setStatus("saving");

    try {
      if (task) {
        await trpc.task.update.mutate({ id: task.id, ...result.data });
      } else {
        await trpc.task.create.mutate(result.data);
      }
    } catch (cause) {
      const code = isTRPCClientError<AppRouter>(cause) ? cause.data?.code : undefined;
      setError(code === "NOT_FOUND"
        ? "This task no longer exists. Your changes have not been saved."
        : "The task could not be saved. Check your connection and try again.");
      setStatus("idle");
      submissionLocked.current = false;
      // The alert remains mounted, so focus can move there before React updates its text.
      errorMessage.current?.focus();
      return;
    }

    setStatus("saved");
    // A document navigation guarantees a fresh SSR read after the mutation completes.
    window.location.replace(`/tasks?saved=${task ? "updated" : "created"}`);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <noscript>JavaScript is required to save tasks.</noscript>
      <p ref={errorMessage} role="alert" tabIndex={-1} className={styles.error}>
        {error}
      </p>
      <fieldset disabled={busy}>
        <legend className={styles.legend}>Task details</legend>
        <label htmlFor="title">Title <span>(required)</span></label>
        <input
          ref={titleInput}
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? "title-error" : undefined}
        />
        {fieldErrors.title && <p id="title-error" className={styles.error}>{fieldErrors.title}</p>}
        <label htmlFor="description">Description <span>(optional)</span></label>
        <textarea
          ref={descriptionInput}
          id="description"
          name="description"
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={fieldErrors.description ? "description-error" : undefined}
        />
        {fieldErrors.description && <p id="description-error" className={styles.error}>{fieldErrors.description}</p>}
        <div className={styles.actions}>
          <button type="submit">{busy ? "Saving…" : "Save task"}</button>
          <button type="button" onClick={() => {
            if (!submissionLocked.current) router.push("/tasks");
          }}>Cancel</button>
        </div>
      </fieldset>
      <p role="status">
        {status === "saving" && "Saving your task…"}
        {status === "saved" && "Task saved. Returning to the task list…"}
      </p>
    </form>
  );
}
