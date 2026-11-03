import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../src/server/api/router";

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "http://127.0.0.1:3101/api/trpc" })],
});

// This suite owns a separate production server and its in-memory store.
test.afterEach(async () => {
  for (const task of await client.task.list.query()) {
    await client.task.delete.mutate({ id: task.id });
  }
});

test("rejects blank titles locally and focuses the associated field", async ({ page }) => {
  let requests = 0;
  page.on("request", request => {
    if (request.method() === "POST") requests++;
  });
  await page.goto("/tasks/new");
  for (const title of ["", "   "]) {
    await page.getByLabel("Title (required)", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByText("Title is required.", { exact: true })).toBeVisible();
    await expect(page.locator("#title")).toBeFocused();
    await expect(page.locator("#title")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#title")).toHaveAttribute("aria-describedby", "title-error");
  }
  expect(requests).toBe(0);
});

test("creates once while pending and navigates to a fresh server-rendered list", async ({ page, request }) => {
  let requests = 0;
  let documents = 0;
  page.on("request", outgoing => {
    if (outgoing.method() === "POST" && outgoing.url().includes("task.create")) requests++;
    if (outgoing.isNavigationRequest() && new URL(outgoing.url()).pathname === "/tasks") documents++;
  });
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task", exact: true }).click();
  await page.getByLabel("Title (required)", { exact: true }).fill("  Created task  ");
  await page.getByLabel("Description (optional)", { exact: true }).fill("Task description");

  const { promise: gate, resolve: releaseRequest } = Promise.withResolvers<void>();
  await page.route("**/api/trpc/task.create*", async route => {
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Saving your task…");
    await page.locator("form").evaluate(form => {
      if (!(form instanceof HTMLFormElement)) throw new Error("Expected a task form.");
      form.requestSubmit();
      form.requestSubmit();
    });
  } finally {
    releaseRequest();
  }

  await expect(page).toHaveURL(/\/tasks\?saved=created$/);
  await expect(page.getByRole("heading", { name: "Created task", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Task created successfully.");
  expect(requests).toBe(1);
  expect(documents).toBe(2);
  expect(await client.task.list.query()).toHaveLength(1);
  const response = await request.get("/tasks");
  const main = (await response.text()).match(/<main[\s\S]*?<\/main>/)?.[0];
  expect(main).toContain("Created task");
  expect(main).toContain("Task description");
});

test("preloads editing on the server and preserves immutable fields", async ({ page, request }) => {
  const task = await client.task.create.mutate({ title: "Original title", description: "Original description" });
  const response = await request.get(`/tasks/${task.id}/edit`);
  const html = await response.text();
  expect(html).toContain('value="Original title"');
  expect(html).toContain(">Original description</textarea>");

  await page.goto("/tasks");
  await page.getByRole("link", { name: `Edit task: ${task.title}`, exact: true }).click();
  await expect(page.getByLabel("Title (required)", { exact: true })).toHaveValue(task.title);
  await expect(page.getByLabel("Description (optional)", { exact: true })).toHaveValue(task.description ?? "");
  await page.getByLabel("Title (required)", { exact: true }).fill("Updated title");
  await page.getByLabel("Description (optional)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\?saved=updated$/);
  await expect(page.getByRole("heading", { name: "Updated title", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Task updated successfully.");
  const updated = await client.task.get.query({ id: task.id });
  expect(updated.id).toBe(task.id);
  expect(updated.createdAt).toBe(task.createdAt);
  expect(updated.description).toBeUndefined();
});

test("preserves input after network failure and allows retry", async ({ page }) => {
  await page.goto("/tasks/new");
  await page.getByLabel("Title (required)", { exact: true }).fill("Preserved title");
  await page.getByLabel("Description (optional)", { exact: true }).fill("Preserved description");
  await page.route("**/api/trpc/task.create*", route => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const alert = page.getByRole("alert").filter({ hasText: "The task could not be saved." });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(page.getByLabel("Title (required)", { exact: true })).toHaveValue("Preserved title");
  await expect(page.getByLabel("Description (optional)", { exact: true })).toHaveValue("Preserved description");
  await expect(page.getByRole("button", { name: "Save task", exact: true })).toBeEnabled();
  expect(await client.task.list.query()).toHaveLength(0);
  await page.unroute("**/api/trpc/task.create*");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\?saved=created$/);
  await expect(page.getByRole("heading", { name: "Preserved title", exact: true })).toBeVisible();
});

test("repeated saves refresh a previously visited list and replace the form in history", async ({ page, request }) => {
  await client.task.create.mutate({ title: "Initial title" });
  await page.goto("/tasks?saved=updated");

  for (const [currentTitle, nextTitle] of [
    ["Initial title", "First update"],
    ["First update", "Second update"],
  ]) {
    await page.getByRole("link", { name: `Edit task: ${currentTitle}`, exact: true }).click();
    await page.getByLabel("Title (required)", { exact: true }).fill(nextTitle);
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page).toHaveURL(/\/tasks\?saved=updated$/);
    await expect(page.getByRole("heading", { name: nextTitle, exact: true })).toBeVisible();
    const response = await request.get("/tasks");
    expect((await response.text()).match(/<main[\s\S]*?<\/main>/)?.[0]).toContain(nextTitle);
  }

  await page.goBack();
  await expect(page).toHaveURL(/\/tasks\?saved=updated$/);
  await expect(page.getByRole("heading", { name: "Edit task", exact: true })).toHaveCount(0);
});

test("handles a task removed during editing without losing input", async ({ page }) => {
  const task = await client.task.create.mutate({ title: "Original" });
  await page.goto(`/tasks/${task.id}/edit`);
  await page.getByLabel("Title (required)", { exact: true }).fill("Unsaved title");
  await client.task.delete.mutate({ id: task.id });
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This task no longer exists." })).toBeVisible();
  await expect(page.getByLabel("Title (required)", { exact: true })).toHaveValue("Unsaved title");
  await expect(page.getByRole("button", { name: "Save task", exact: true })).toBeEnabled();
});

test("handles invalid and missing IDs and cancels without saving", async ({ page }) => {
  for (const id of ["invalid", randomUUID()]) {
    await page.goto(`/tasks/${id}/edit`);
    await expect(page.getByRole("heading", { name: "Task not found", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to tasks", exact: true })).toHaveAttribute("href", "/tasks");
  }
  const task = await client.task.create.mutate({ title: "Original" });
  await page.goto(`/tasks/${task.id}/edit`);
  await page.getByLabel("Title (required)", { exact: true }).fill("Discarded title");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  expect(await client.task.get.query({ id: task.id })).toEqual(task);
});

test("fits mobile screens and keeps keyboard focus visible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tasks/new");
  await page.getByLabel("Title (required)", { exact: true }).fill("Long title ".repeat(30));
  await page.getByLabel("Description (optional)", { exact: true }).fill("Long description ".repeat(30));
  await page.getByLabel("Title (required)", { exact: true }).focus();
  expect(await page.locator("#title").evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  expect(await page.locator("html").evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(375);
});
