import "server-only";
import { z } from "zod";
import {
  createCallerFactory,
  createRouter,
  publicProcedure,
} from "./trpc.ts";
import { taskRouter } from "./tasks.ts";

export const appRouter = createRouter({
  task: taskRouter,
  health: publicProcedure
    .output(z.object({ status: z.literal("ok") }))
    .query(() => ({ status: "ok" as const })),
});

export const createCaller = createCallerFactory(appRouter);
export type AppRouter = typeof appRouter;
