import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { taskIdSchema } from "@/lib/task";
import type { Task } from "@/lib/task";
import { createCaller } from "@/server/api/router";
import TaskForm from "../../task-form";

export const metadata: Metadata = { title: "Edit task | Artefact" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditTaskPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const input = taskIdSchema.safeParse(await params);
  if (!input.success) notFound();

  let task: Task;
  try {
    task = await createCaller({}).task.get(input.data);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  return (
    <main>
      <h1>Edit task</h1>
      <p>Update the title or description. Leave the description empty to remove it.</p>
      <TaskForm task={task} />
    </main>
  );
}
