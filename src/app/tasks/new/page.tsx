import type { Metadata } from "next";
import TaskForm from "../task-form";

export const metadata: Metadata = { title: "New task | Artefact" };

export default function NewTaskPage() {
  return (
    <main>
      <h1>New task</h1>
      <p>Add a title and an optional description.</p>
      <TaskForm />
    </main>
  );
}
