import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { tasks } from "../tasks.ts";
import { appRouter, createCaller } from "./router.ts";

const caller = createCaller({});
const hasCode = (code: TRPCError["code"]) => (error: unknown) =>
  error instanceof TRPCError && error.code === code;

beforeEach(() => tasks.clear());

test("creates tasks with unique IDs, timestamps and trimmed titles", async () => {
  const before = Date.now();
  const first = await caller.task.create({ title: "  First task  " });
  const second = await caller.task.create({ title: "Second task", description: "Details" });
  assert.equal(first.title, "First task");
  assert.equal(first.description, undefined);
  assert.equal(second.description, "Details");
  assert.notEqual(first.id, second.id);
  assert.ok(Number.isInteger(first.createdAt));
  assert.ok(first.createdAt >= before && first.createdAt <= Date.now());
  assert.deepEqual(await caller.task.list(), [first, second]);
});

test("returns an empty list initially", async () => {
  assert.deepEqual(await caller.task.list(), []);
});

test("loads one task without exposing a mutable store reference", async () => {
  const first = await caller.task.create({ title: "First", description: "Details" });
  await caller.task.create({ title: "Second" });
  const loaded = await caller.task.get({ id: first.id });
  assert.deepEqual(loaded, first);
  loaded.title = "Changed outside the store";
  assert.deepEqual(await caller.task.get({ id: first.id }), first);
});

test("get rejects malformed IDs and reports missing tasks", async () => {
  await assert.rejects(caller.task.get({ id: "invalid" }), hasCode("BAD_REQUEST"));
  await assert.rejects(caller.task.get({ id: randomUUID() }), hasCode("NOT_FOUND"));
});

for (const title of ["", "   ", "\t\n"]) {
  test(`rejects blank titles on create and update: ${JSON.stringify(title)}`, async () => {
    await assert.rejects(caller.task.create({ title }), hasCode("BAD_REQUEST"));
    const task = await caller.task.create({ title: "Original" });
    await assert.rejects(caller.task.update({ id: task.id, title }), hasCode("BAD_REQUEST"));
    assert.deepEqual(await caller.task.list(), [task]);
  });
}

test("updates editable fields while preserving ID and creation time", async (context) => {
  const clock = context.mock.method(Date, "now", () => 1_700_000_000_000);
  const task = await caller.task.create({ title: "Original", description: "Old details" });
  clock.mock.mockImplementation(() => 1_700_000_060_000);
  const updated = await caller.task.update({ id: task.id, title: "  Updated  ", description: "New details" });
  assert.deepEqual(updated, { ...task, title: "Updated", description: "New details" });
  assert.deepEqual(await caller.task.list(), [updated]);
  const withoutDescription = await caller.task.update({ id: task.id, title: "Updated" });
  assert.equal(withoutDescription.description, undefined);
  assert.equal(withoutDescription.createdAt, task.createdAt);
});

test("deletes only the requested task", async () => {
  const first = await caller.task.create({ title: "First" });
  const second = await caller.task.create({ title: "Second" });
  assert.deepEqual(await caller.task.delete({ id: first.id }), { id: first.id });
  assert.deepEqual(await caller.task.list(), [second]);
  await assert.rejects(caller.task.delete({ id: first.id }), hasCode("NOT_FOUND"));
});

test("reports NOT_FOUND for missing task IDs", async () => {
  const id = randomUUID();
  await assert.rejects(caller.task.update({ id, title: "Missing" }), hasCode("NOT_FOUND"));
  await assert.rejects(caller.task.delete({ id }), hasCode("NOT_FOUND"));
  assert.deepEqual(await caller.task.list(), []);
});

test("rejects malformed IDs", async () => {
  for (const id of ["", "invalid", "   "]) {
    await assert.rejects(caller.task.update({ id, title: "Invalid" }), hasCode("BAD_REQUEST"));
    await assert.rejects(caller.task.delete({ id }), hasCode("BAD_REQUEST"));
  }
});

test("returned objects cannot mutate stored tasks through the server caller", async () => {
  const task = await caller.task.create({ title: "Original" });
  task.title = "Changed outside the store";
  const listed = await caller.task.list();
  assert.equal(listed[0].title, "Original");
  listed[0].title = "Changed list item";
  const updated = await caller.task.update({ id: task.id, title: "Updated" });
  updated.title = "Changed update result";
  assert.equal((await caller.task.list())[0].title, "Updated");
});

test("separate server callers share the same store", async () => {
  const task = await caller.task.create({ title: "Shared" });
  assert.deepEqual(await createCaller({}).task.list(), [task]);
});

async function request(path: string, input: unknown) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`http://localhost/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
    router: appRouter,
    createContext: () => ({}),
  });
}

test("HTTP procedures share state with the server caller", async () => {
  const response = await request("task.create", { title: "Created over HTTP" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(await caller.task.list(), [body.result.data]);
  const deletion = await request("task.delete", { id: body.result.data.id });
  assert.equal(deletion.status, 200);
  assert.deepEqual(await caller.task.list(), []);
});

test("HTTP errors report BAD_REQUEST and NOT_FOUND", async () => {
  const invalid = await request("task.create", { title: " " });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.data.code, "BAD_REQUEST");
  const missing = await request("task.update", { id: randomUUID(), title: "Missing" });
  assert.equal(missing.status, 404);
  const body = await missing.json();
  assert.equal(body.error.data.code, "NOT_FOUND");
  assert.equal(body.error.message, "Task not found.");
});

test("rejects missing or invalid field types and attempts to set immutable fields", async () => {
  for (const input of [
    {},
    { title: null },
    { title: 123 },
    { title: "Valid", description: 123 },
    { title: "Valid", id: randomUUID() },
    { title: "Valid", createdAt: 0 },
  ]) {
    const response = await request("task.create", input);
    assert.equal(response.status, 400);
  }
  const task = await caller.task.create({ title: "Original" });
  for (const input of [
    { id: task.id },
    { id: task.id, title: null },
    { id: task.id, title: "Valid", description: 123 },
    { ...task, title: "Changed", createdAt: 0 },
  ]) {
    const response = await request("task.update", input);
    assert.equal(response.status, 400);
  }
  assert.deepEqual(await caller.task.list(), [task]);
});
