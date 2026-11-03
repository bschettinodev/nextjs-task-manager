import "server-only";
import type { Task } from "../lib/task.ts";

const processGlobal = globalThis as typeof globalThis & {
  taskStore?: Map<string, Task>;
};

// Share state across server bundles and development module reloads in this process.
export const tasks = (processGlobal.taskStore ??= new Map<string, Task>());
