"use client";

export default function TasksError() {
  return (
    <main>
      <h1>This page could not be loaded</h1>
      <p>Please try again in a moment.</p>
      <button type="button" onClick={() => window.location.reload()}>Try again</button>
      <p><a href="/tasks">Back to tasks</a></p>
    </main>
  );
}
