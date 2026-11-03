import "server-only";
import { z } from "zod";
import {
  createCallerFactory,
  createRouter,
  publicProcedure,
} from "./trpc";

export const appRouter = createRouter({
  health: publicProcedure
    .output(z.object({ status: z.literal("ok") }))
    .query(() => ({ status: "ok" as const })),
});

export const createCaller = createCallerFactory(appRouter);
export type AppRouter = typeof appRouter;
