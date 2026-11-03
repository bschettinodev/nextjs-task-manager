import "server-only";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { taskFieldsSchema, taskIdSchema, updateTaskSchema } from "../../lib/task.ts";
import type { Task } from "../../lib/task.ts";
import { tasks } from "../tasks.ts";
import { createRouter, publicProcedure } from "./trpc.ts";

export const taskRouter = createRouter({
  create: publicProcedure.input(taskFieldsSchema).mutation(({ input }) => {
    const task: Task = {
      id: randomUUID(),
      ...input,
      createdAt: Date.now(),
    };
    tasks.set(task.id, task);
    return { ...task };
  }),

  list: publicProcedure.query(() =>
    Array.from(tasks.values(), (task) => ({ ...task })),
  ),

  get: publicProcedure.input(taskIdSchema).query(({ input }) => {
    const task = tasks.get(input.id);
    if (!task) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    }
    return { ...task };
  }),

  update: publicProcedure.input(updateTaskSchema).mutation(({ input }) => {
    const current = tasks.get(input.id);
    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    }

    const updated: Task = {
      id: current.id,
      title: input.title,
      description: input.description,
      createdAt: current.createdAt,
    };
    tasks.set(current.id, updated);
    return { ...updated };
  }),

  delete: publicProcedure.input(taskIdSchema).mutation(({ input }) => {
    if (!tasks.delete(input.id)) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    }
    return { id: input.id };
  }),
});
