import { z } from "zod";

export type Task = {
  readonly id: string;
  title: string;
  description?: string;
  readonly createdAt: number;
};

export const taskFieldsSchema = z.strictObject({
  title: z
    .string({ error: "Title must be a string." })
    .trim()
    .min(1, "Title is required."),
  description: z.string({ error: "Description must be a string." }).optional(),
});

export const taskIdSchema = z.strictObject({
  id: z.uuid({ error: "Task ID must be a valid UUID." }),
});

// Updates replace editable fields; omitting description clears it.
export const updateTaskSchema = taskFieldsSchema.extend(taskIdSchema.shape);
