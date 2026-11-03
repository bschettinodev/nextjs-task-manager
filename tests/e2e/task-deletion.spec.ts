import { test, expect } from "@playwright/test";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../src/server/api/router";

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "http://127.0.0.1:3101/api/trpc" })],
});

test.afterEach(async () => {
  for (const task of await client.task.list.query()) {
    await client.task.delete.mutate({ id: task.id });
  }
});

test("confirmation identifies the task and cancellation restores focus without deleting", async ({ page }) => {
  const task = await client.task.create.mutate({ title: "Keep this task" });
  let deletes = 0;
  page.on("request", request => {
    if (request.method() === "POST" && request.url().includes("task.delete")) deletes++;
  });
  await page.goto("/tasks");
  const trigger = page.getByRole("button", { name: `Delete task: ${task.title}`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Delete task?", exact: true });
  await expect(dialog).toContainText(task.title);
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Delete task", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await client.task.get.query({ id: task.id })).toEqual(task);
  expect(deletes).toBe(0);
});

test("deletes once and refreshes SSR in place while preserving other tasks and feedback", async ({ page, request }) => {
  const removed = await client.task.create.mutate({ title: "Remove this task" });
  const retained = await client.task.create.mutate({ title: "Keep this task", description: "Keep these details" });
  let deletes = 0;
  let documents = 0;
  page.on("request", outgoing => {
    if (outgoing.method() === "POST" && outgoing.url().includes("task.delete")) deletes++;
    if (outgoing.isNavigationRequest()) documents++;
  });
  const mutationGate = Promise.withResolvers<void>();
  const refreshGate = Promise.withResolvers<void>();
  await page.goto("/tasks");
  await page.getByRole("button", { name: `Delete task: ${removed.title}`, exact: true }).click();
  await page.route("**/api/trpc/task.delete*", async route => {
    await mutationGate.promise;
    await route.continue();
  });
  await page.route("**/tasks*", async route => {
    if (route.request().headers().rsc === "1") await refreshGate.promise;
    await route.continue();
  });
  const dialog = page.getByRole("dialog", { name: "Delete task?", exact: true });
  try {
    await dialog.getByRole("button", { name: "Delete task", exact: true }).dblclick();
    await expect(dialog.getByRole("button", { name: "Deleting…", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Task deleted:" })).toHaveCount(0);
    expect(await client.task.get.query({ id: removed.id })).toEqual(removed);
    mutationGate.resolve();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("Updating the task list…", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(`Task deleted: ${removed.title}.`);
    await expect(page.getByRole("status")).toBeFocused();
    await expect(page.locator("li").filter({ hasText: removed.title })).toBeVisible();
  } finally {
    mutationGate.resolve();
    refreshGate.resolve();
  }
  await expect(page.getByRole("heading", { name: removed.title, exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: retained.title, exact: true })).toBeVisible();
  await expect(page.getByText("Updating the task list…", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText(`Task deleted: ${removed.title}.`);
  await expect(page.getByRole("status")).toBeFocused();
  expect(deletes).toBe(1);
  expect(documents).toBe(1);
  expect(await client.task.list.query()).toEqual([retained]);
  const html = await (await request.get("/tasks")).text();
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0];
  expect(main).not.toContain(removed.title);
  expect(main).toContain(retained.title);
  expect(main).toContain(retained.description);
});

test("deleting the last task shows the empty state and keeps success feedback", async ({ page }) => {
  const task = await client.task.create.mutate({ title: "Last task" });
  await page.goto("/tasks");
  await page.getByRole("button", { name: `Delete task: ${task.title}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tasks yet", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(`Task deleted: ${task.title}.`);
  await expect(page.getByRole("status")).toBeFocused();
  expect(await client.task.list.query()).toEqual([]);
});

test("network failure preserves the task and permits a successful retry", async ({ page }) => {
  const task = await client.task.create.mutate({ title: "Retry deletion" });
  await page.goto("/tasks");
  await page.getByRole("button", { name: `Delete task: ${task.title}`, exact: true }).click();
  await page.route("**/api/trpc/task.delete*", route => route.abort("internetdisconnected"));
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("The task could not be deleted. Check your connection and try again.");
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Delete task", exact: true })).toBeEnabled();
  expect(await client.task.get.query({ id: task.id })).toEqual(task);
  await page.unroute("**/api/trpc/task.delete*");
  await dialog.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tasks yet", exact: true })).toBeVisible();
});

test("an already removed task reports NOT_FOUND and can refresh the stale list", async ({ page }) => {
  const task = await client.task.create.mutate({ title: "Removed elsewhere" });
  await page.goto("/tasks");
  await page.getByRole("button", { name: `Delete task: ${task.title}`, exact: true }).click();
  await client.task.delete.mutate({ id: task.id });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("This task no longer exists. Refresh the list to continue.");
  await expect(page.locator("li").filter({ hasText: task.title })).toBeVisible();
  await dialog.getByRole("button", { name: "Refresh list", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tasks yet", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("Task deleted:");
});

test("BAD_REQUEST is handled without leaking internal errors or removing the task", async ({ page }) => {
  const task = await client.task.create.mutate({ title: "Invalid deletion request" });
  await page.goto("/tasks");
  await page.getByRole("button", { name: `Delete task: ${task.title}`, exact: true }).click();
  await page.route("**/api/trpc/task.delete*", route => route.fulfill({
    status: 400,
    contentType: "application/json",
    body: JSON.stringify([{ error: {
      message: "INTERNAL_TEST_DETAIL",
      code: -32600,
      data: { code: "BAD_REQUEST", httpStatus: 400, path: "task.delete" },
    } }]),
  }));
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("This task has an invalid ID. Refresh the list to continue.");
  await expect(page.locator("body")).not.toContainText("INTERNAL_TEST_DETAIL");
  expect(await client.task.get.query({ id: task.id })).toEqual(task);
});

test("mobile confirmation wraps long titles and completes deletion", async ({ page }) => {
  const task = await client.task.create.mutate({ title: "LongTaskTitle".repeat(25) });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tasks");
  await page.getByRole("button", { name: `Delete task: ${task.title}`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(343);
  expect(await page.locator("html").evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(375);
  await dialog.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No tasks yet", exact: true })).toBeVisible();
});
