# Task Manager

A web application for creating, viewing, editing and deleting tasks, with a server-rendered list and a responsive interface.

## Features

- Create and edit tasks with a required title and an optional description.
- View tasks and their creation dates.
- Delete tasks with confirmation.
- Get validation, loading, success and error feedback.

## Tech Stack

Next.js 15, React, TypeScript, tRPC and Zod. Tests use the Node.js test runner and Playwright.

## Getting Started

Use Node.js 24 and npm. No database or environment file is required.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and select **View tasks**.

For a production build:

```sh
npm run build
npm start
```

Stop the development server before building or running E2E tests, since they share the `.next` directory.

## Testing

Run lint, type checking and backend tests:

```sh
npm run lint
npm run typecheck
npm test
```

Install Chromium once, then run the E2E tests:

```sh
npx playwright install chromium
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium` if browser system dependencies are needed. E2E tests build the application and start their own production server on port 3101; keep that port available.

## Technical Notes

- Next.js App Router renders the task list on the server, so tasks are included in the initial HTML.
- tRPC provides typed communication between the frontend and backend. Zod validates input in the form and on the server.
- Tasks are stored in memory and lost when the server restarts. Each server process has its own list. No authentication is implemented.
- Reading the list works without browser JavaScript. Creating, editing and deleting tasks require JavaScript.
