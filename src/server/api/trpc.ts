import "server-only";
import { initTRPC } from "@trpc/server";

const t = initTRPC.create({
  errorFormatter({ shape, error }) {
    if (error.code !== "INTERNAL_SERVER_ERROR") return shape;
    return {
      ...shape,
      message: "An unexpected error occurred. Please try again.",
      data: { ...shape.data, stack: undefined },
    };
  },
});

export const createRouter = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
