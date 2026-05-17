# Mini Apty

A Chrome Manifest V3 extension for recording and replaying interactive walkthroughs on any website, backed by a Node.js/SQLite REST API.

---

## Stack

| Layer | Tech |
|---|---|
| Extension | Chrome MV3, TypeScript strict, React 18, Zustand, Zod |
| Build | pnpm workspaces, Vite 5 + @crxjs/vite-plugin |
| Backend | Node.js, Fastify, TypeScript strict, Drizzle ORM, SQLite (better-sqlite3) |
| Auth | JWT (7-day expiry), bcrypt |
| Tests | Vitest + supertest (in-memory SQLite) |

---

## Project Structure

```
mini-apty/
├── packages/
│   ├── backend/          # Fastify API
│   │   └── src/
│   │       ├── db/       # Drizzle schema + lazy SQLite init
│   │       ├── routes/   # auth.ts  walkthroughs.ts
│   │       ├── services/ # authService  walkthroughService
│   │       └── middleware/authenticate.ts
│   └── extension/        # Chrome MV3 extension
│       └── src/
│           ├── background/   # Service worker
│           ├── content/      # Injected scripts (recorder + player)
│           │   ├── recorder/ # fingerprint.ts  elementPicker.ts
│           │   └── player/   # elementResolver.ts  balloon.ts
│           ├── shared/       # types  messages  storage helpers
│           └── sidepanel/    # React UI (auth, list, editor, recording)
```

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- pnpm 9+  (`npm i -g pnpm`)
- Docker (optional, for containerised backend)

### 2. Install dependencies

```bash
cd mini-apty
pnpm install
```

### 3. Configure environment

```bash
cp .env.example packages/backend/.env
# Edit packages/backend/.env and set a real JWT_SECRET
```

### 4a. Run backend with Docker (recommended)

```bash
docker compose up
# API is now at http://localhost:3000
```

### 4b. Run backend locally (no Docker)

```bash
pnpm --filter backend dev
# tsx watch starts the server; SQLite file created at packages/backend/data/mini-apty.db
```

### 5. Build the extension

```bash
pnpm --filter extension build
# Output: packages/extension/dist/
```

### 6. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `packages/extension/dist`
5. Click the Mini Apty puzzle-piece icon → side panel opens

---

## Using the Extension

### Author mode — recording a walkthrough

1. Navigate to any page (e.g. `https://github.com`)
2. Open Mini Apty from the toolbar (side panel appears)
3. Sign up or log in
4. Click **+ New** in the side panel
5. Enter a title and path pattern (e.g. `/login`), click **Start Recording**
6. Click **🎯 Capture Next Element** — a blue banner appears at the top of the page
7. Click any element on the page to capture it (fingerprint stored)
8. Fill in a **title** and optional **description** for the step in the side panel
9. Choose an **advance trigger** (Next button / Click element / Input change)
10. Repeat steps 6–9 for each step
11. Click **Save Walkthrough** — persisted to backend + local cache

### Preview mode — replaying a walkthrough

1. Navigate to the page where the walkthrough was recorded
2. Open Mini Apty; the walkthrough appears in the list
3. Click **▶ Preview**
4. A floating balloon anchors to the first element, with step title and description
5. Click **Next →** (or trigger the configured advance action) to progress
6. Click **←** to go back, or **×** to exit

### Edit mode

Click **✎** next to any walkthrough to edit titles, descriptions, triggers, or delete steps.

---

## Backend API

Base URL: `http://localhost:3000`

### Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/signup` | `{ email, password }` | `{ token, user }` |
| POST | `/auth/login`  | `{ email, password }` | `{ token, user }` |

All walkthrough routes require `Authorization: Bearer <token>`.

### Walkthroughs

| Method | Path | Description |
|---|---|---|
| GET    | `/walkthroughs?origin=https://example.com` | List walkthroughs for origin |
| POST   | `/walkthroughs` | Create walkthrough |
| GET    | `/walkthroughs/:id` | Get by ID |
| PUT    | `/walkthroughs/:id` | Update title / path / steps |
| DELETE | `/walkthroughs/:id` | Delete |

**Authorization model**: 401 = missing/invalid token. 403 = valid token but wrong owner.

---

## Running Tests

```bash
pnpm --filter backend test
```

Tests use an **in-memory SQLite database** (set via `vitest.config.ts`) so no file system side effects.

---

## Design Decisions

### Element Targeting (the hard part)

Plain `querySelector` breaks when a page re-renders. Each captured step stores a **fingerprint** — a priority chain of stable attributes:

```
id  →  data-testid / data-cy  →  aria-label  →  name  →  placeholder
  →  text content  →  href (anchors)  →  XPath
```

When replaying, each strategy is tried in order. If multiple candidates match, they are **proximity-scored** against the stored bounding rect; the closest one wins.

**Trade-offs**: Works well on apps that use semantic HTML (`aria-label`, `data-testid`). Fails if none of those exist and the element's text changes (e.g. i18n). The XPath fallback breaks on major re-renders. Best practice for authors: prefer elements that have `data-testid` or a unique `aria-label`.

### CSS Isolation

The player balloon and the recorder's highlight ring both live inside a **Shadow DOM** host element appended to `document.documentElement`. A full CSS reset inside the shadow root prevents host-page styles leaking in. The recording highlight uses `box-shadow` (no layout shift, no `outline`). The shadow host is `position:fixed` with `pointer-events:none` by default; only the balloon has `pointer-events:all`.

This means Mini Apty's UI **cannot** break or be broken by the host page's styles, z-index stacking, or event handlers.

### Cross-Origin Storage

Walkthroughs are keyed by `origin` on the backend. The same account accessed from any machine/browser pointing at the same backend URL returns the same walkthroughs.

### Offline / Network Failure Tolerance

- After every successful GET, walkthroughs are written to `chrome.storage.local` (keyed by origin)
- If the backend is unreachable, the API client falls back to the local cache and the side panel shows an "Offline" banner
- The player never hard-crashes: if the backend is down, the cached walkthrough is used; if there's no cache, a clear error state is shown

### Service Worker (MV3)

All routing between the side panel and content scripts goes through the background service worker (`background/index.ts`). Messages are categorised by type and forwarded appropriately. This avoids direct side-panel ↔ content-script communication which MV3 doesn't support cleanly.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `dev-secret-must-change` | HMAC secret for JWT signing — **change in production** |
| `DATABASE_URL` | `./data/mini-apty.db` | SQLite file path. Use `:memory:` for tests |
| `PORT` | `3000` | HTTP port |

---

## Development Notes

- The database is **auto-created** on first start (no manual migration step)
- `pnpm --filter backend dev` uses `tsx watch` for instant TypeScript reload
- `pnpm --filter extension dev` runs Vite in watch mode — reload the extension in `chrome://extensions` after a change
- The backend allows CORS from `chrome-extension://` origins and `localhost`
