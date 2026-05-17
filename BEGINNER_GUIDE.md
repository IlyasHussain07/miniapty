# Mini Apty: A Complete Beginner's Guide

If you only know **React and JavaScript**, this guide explains everything in this project step-by-step. We'll cover Chrome extensions, TypeScript, backend development, and how everything works together.

---

## Table of Contents

1. [What is Mini Apty?](#what-is-mini-apty)
2. [What is a Chrome Extension?](#what-is-a-chrome-extension)
3. [Project Structure](#project-structure)
4. [The Architecture](#the-architecture)
5. [Frontend (Extension)](#frontend-extension)
6. [Backend (Server)](#backend-server)
7. [How They Communicate](#how-they-communicate)
8. [Key Concepts You Need to Know](#key-concepts-you-need-to-know)
9. [Running the Project](#running-the-project)
10. [The Recording Flow](#the-recording-flow)
11. [The Playback Flow](#the-playback-flow)

---

## What is Mini Apty?

**Mini Apty** is a tool that lets you **record interactive walkthroughs** on websites.

Think of it like this:
- You're on a website (e.g., Wikipedia)
- You click "Start Recording"
- You click elements on the page you want to highlight (button, input field, link)
- The extension records each element and lets you add descriptions
- You save it as a "walkthrough"
- Later, anyone can play back this walkthrough — it shows a balloon pointing to each element with instructions

**Real-world example:**
- A company records a walkthrough: "How to use our checkout form"
- Users can play this walkthrough on the website
- The extension shows: "Step 1: Click the product button" → highlights the button → user clicks it → "Step 2: Fill in your email" → etc.

---

## What is a Chrome Extension?

A Chrome extension is a small program that runs inside your browser and enhances or modifies how websites work.

### Normal Website vs Chrome Extension

**Normal Website:**
- You visit `google.com`
- Server sends HTML/CSS/JS
- Browser renders a page in your tab
- You interact with it

**Chrome Extension:**
- You install it from Chrome Web Store (or load it manually)
- It runs in the background of your browser
- It can modify any website you visit
- It can add a UI panel (sidebar, popup, etc.)
- It can intercept network requests, access storage, etc.

### Chrome Extension Parts

Mini Apty extension has these parts:

| Part | What it is | What it does |
|---|---|---|
| **Service Worker** (background) | Special JS file | Listens for messages, routes them between extension parts |
| **Content Script** | JS injected into every page | Can modify the page, record clicks, show highlights |
| **Side Panel** (UI) | React app in a sidebar | Shows login, walkthrough list, recording interface |
| **Manifest** | Configuration file | Tells Chrome what the extension needs (permissions, files, etc.) |

### Manifest V3

Chrome extensions come in versions. We're using **MV3** (Manifest V3), the newest standard. If you see code with "service worker" instead of "background page", that's MV3.

---

## Project Structure

This is a **monorepo** — one git repo containing multiple related projects.

```
practice_chrome/
├── packages/
│   ├── extension/          ← Chrome extension (the UI)
│   │   ├── src/
│   │   │   ├── manifest.json          ← Extension config
│   │   │   ├── background/            ← Service worker
│   │   │   ├── content/               ← Content script (injected into pages)
│   │   │   ├── sidepanel/             ← React app (the sidebar UI)
│   │   │   │   ├── App.tsx            ← Main React component
│   │   │   │   ├── components/        ← UI components (login, list, recording, etc.)
│   │   │   │   ├── store/             ← Zustand store (shared state)
│   │   │   │   └── api/               ← Code to talk to backend
│   │   │   └── shared/                ← Types and code used everywhere
│   │   └── dist/                      ← Built extension (ready to load)
│   │
│   └── backend/            ← Node.js server (the database & API)
│       ├── src/
│       │   ├── app.ts               ← Main server setup
│       │   ├── db/                  ← Database code (SQLite)
│       │   ├── routes/              ← API endpoints (/auth, /walkthroughs)
│       │   ├── services/            ← Business logic
│       │   ├── middleware/          ← Authentication check
│       │   └── types.ts             ← Type definitions
│       └── data/                    ← Where the database file lives
│
├── pnpm-workspace.yaml     ← Monorepo config (tells pnpm about packages/)
├── DOUBLE_CAPTURE_BUG.md   ← Doc about the double-capture bug fix
└── README.md               ← Main readme
```

### What's in `dist/`?

When you run `pnpm --filter extension build`, it creates a `dist/` folder with everything Chrome needs to load the extension. This is what you load in `chrome://extensions`.

---

## The Architecture

Here's how all the pieces connect:

```
┌─────────────────────────────────────────────────────────────┐
│ User's Browser                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ANY WEBSITE (google.com, wikipedia.com, etc.)        │  │
│  │                                                      │  │
│  │  ┌─────────────────────────────────────────────┐   │  │
│  │  │ Content Script (Mini Apty)                 │   │  │
│  │  │ - Listens to clicks                         │   │  │
│  │  │ - Shows element highlighter                 │   │  │
│  │  │ - Shows playback balloon                    │   │  │
│  │  │ - Captures fingerprints of elements        │   │  │
│  │  └─────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↑                                      ↑             │
│    sends messages (e.g.,               receives messages    │
│    "element was clicked")              (e.g., "start pick") │
│         │                                      │             │
│  ┌──────▼──────────────────────────────────────┴─────┐     │
│  │ Service Worker / Background                       │     │
│  │ - Routes messages between Content Script & Panel  │     │
│  │ - Handles auto-injection of content script        │     │
│  └──────┬─────────────────────────────────────────┬──┘     │
│         │                                         │         │
│  ┌──────▼──────────────────────────────────────────▼──┐    │
│  │ Side Panel (React App)                             │    │
│  │ - Login screen                                     │    │
│  │ - Walkthrough list                                 │    │
│  │ - Recording UI (shows steps as you capture)       │    │
│  │ - Playback controls                                │    │
│  │ - Stores state (Zustand)                          │    │
│  │ - Talks to backend via fetch()                    │    │
│  └──────────────────────────────────────────────────┘    │
│         │                                                  │
└─────────┼──────────────────────────────────────────────────┘
          │ HTTP requests & responses
          │ (fetch API)
          │
┌─────────▼──────────────────────────────────────────────────┐
│ Backend (Node.js Server)                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  /auth/signup, /auth/login                                │
│    - User registration & login                            │
│    - Returns JWT token                                    │
│                                                            │
│  /walkthroughs                                             │
│    - Get list of walkthroughs for a user                  │
│    - Create new walkthrough                               │
│    - Update walkthrough                                   │
│    - Delete walkthrough                                   │
│                                                            │
│  SQLite Database (mini-apty.db)                           │
│    - Stores users                                         │
│    - Stores walkthroughs + steps                          │
│    - Stores element fingerprints                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Frontend (Extension)

The extension front-end is built with **React** (which you know!) plus a few new tools.

### Tools/Libraries You Don't Know Yet

| Tool | What it does | Why we use it |
|---|---|---|
| **TypeScript** | JavaScript with type safety | Prevents bugs, better IDE hints |
| **Zustand** | State management (like Redux, Context) | Simpler than Redux, lighter than Context |
| **Zod** | Data validation | Ensures data from backend is valid |
| **Chrome APIs** | Browser extension APIs | `chrome.tabs.sendMessage()`, `chrome.storage`, etc. |
| **Shadow DOM** | Isolated DOM (for the balloon overlay) | Prevents website CSS from breaking our UI |

### Key Files

**`src/sidepanel/App.tsx`** — Main React component
- Shows login, walkthrough list, or recording UI based on current view
- Listens to messages from content script
- Routes messages to appropriate handlers

**`src/sidepanel/store/index.ts`** — Zustand store
- Holds all app state (logged-in user, walkthroughs list, current recording steps, etc.)
- Functions to update state (login, record, save, load walkthroughs)
- Calls backend API

**`src/content/index.ts`** — Content script
- Runs in every tab
- Handles recording: listens to clicks, captures element fingerprints
- Handles playback: shows balloon, highlights elements, listens to user actions
- Sends messages to background service worker

**`src/background/index.ts`** — Service worker
- Receives messages from content script and routes them to sidepanel
- Receives messages from sidepanel and routes them to content script
- Handles auto-injection of content script if it's not loaded

### Recording Flow (Frontend)

1. User clicks "Start Recording" → state changes to `isRecording: true`, view becomes "recording"
2. RecordingPanel shows with "Capture Next Element" button
3. User clicks button → `START_RECORDING` message sent to content script
4. Content script starts element picker (shows floating label, highlights on mouseover)
5. User clicks element on page
6. Content script captures element fingerprint (HTML tag, id, classes, XPath, position, text, etc.)
7. Step created with title auto-generated from element's text/placeholder/aria-label
8. `STEP_CAPTURED` message sent back to sidepanel
9. Step added to `pendingSteps` array in Zustand store
10. UI updates to show the new step
11. User edits title/description in StepCard component
12. User selects advance trigger (Next button, Click this element, Input value change)
13. User repeats 3-12 for each element
14. User clicks "Save Walkthrough" → sends all steps to backend API

---

## Backend (Server)

The backend is **Node.js with Fastify** (a web framework, like Express but faster).

### What You Need to Know About Backend

| Concept | Explanation |
|---|---|
| **Fastify** | Web framework that handles HTTP requests, similar to Express |
| **JWT** | "JSON Web Token" — a secure way to send authentication. User logs in → server returns token → extension includes token in future requests |
| **SQLite** | A simple database (not MySQL/PostgreSQL). Just a file on disk. |
| **Drizzle ORM** | Code that talks to database. You write TypeScript, it converts to SQL. |
| **Zod** | Validates incoming data (is it the right shape? the right types?) |

### API Endpoints

```
POST /auth/signup
  Input: { email, password }
  Output: { token, user: { id, email } }
  What it does: Creates a new user

POST /auth/login
  Input: { email, password }
  Output: { token, user: { id, email } }
  What it does: Logs in an existing user

GET /walkthroughs?origin=http://wikipedia.com
  Header: Authorization: Bearer {token}
  Output: [ { id, title, origin, steps, createdAt, updatedAt }, ... ]
  What it does: Gets all walkthroughs for a specific website

POST /walkthroughs
  Header: Authorization: Bearer {token}
  Body: { title, origin, pathPattern, steps: [ ... ] }
  Output: { id, title, origin, steps, createdAt, updatedAt }
  What it does: Creates a new walkthrough

PUT /walkthroughs/{id}
  Header: Authorization: Bearer {token}
  Body: { title?, pathPattern?, steps? }
  Output: { id, title, origin, steps, createdAt, updatedAt }
  What it does: Updates an existing walkthrough

DELETE /walkthroughs/{id}
  Header: Authorization: Bearer {token}
  Output: (nothing, just 204 status)
  What it does: Deletes a walkthrough
```

### Database Schema

```
users
├── id (unique)
├── email (unique)
├── password (hashed)
└── createdAt

walkthroughs
├── id (unique)
├── userId (who owns it)
├── title
├── origin (e.g., "https://wikipedia.com")
├── pathPattern (e.g., "/wiki/")
├── steps (JSON array)
├── createdAt
└── updatedAt
```

Each step in the `steps` array looks like:
```javascript
{
  id: "uuid",
  title: "Search",
  description: "Click here to search",
  fingerprint: {
    tag: "button",
    id: "search-btn",
    classes: ["btn", "btn-primary"],
    xpath: "/html/body/button[@id='search-btn']",
    innerText: "Search",
    rect: { x: 100, y: 200, w: 80, h: 40 }
  },
  advanceTrigger: "click-target"  // or "next-button" or "input-change"
}
```

---

## How They Communicate

The extension and backend talk to each other, and the different parts of the extension talk to each other.

### Extension Internal Communication (Messages)

Content script, background, and sidepanel use `chrome.runtime.sendMessage()` to send JSON messages.

**Example 1: Recording**
```
Sidepanel: chrome.runtime.sendMessage({ type: 'START_RECORDING' })
  ↓ (routed by background)
Content Script receives it → starts picker
Content Script: chrome.runtime.sendMessage({ type: 'STEP_CAPTURED', step: {...} })
  ↓ (routed by background)
Sidepanel receives it → updates UI
```

**Example 2: Playback**
```
Sidepanel: chrome.runtime.sendMessage({ type: 'START_PLAYER', walkthrough: {...} })
  ↓ (routed by background)
Content Script receives it → shows balloon, highlights element
User clicks element
Content Script: chrome.runtime.sendMessage({ type: 'PLAYER_NEXT' })
  ↓ (routed by background)
Sidepanel receives it (optional, for updating UI)
```

**Message Routing Logic**
```typescript
// In background/index.ts
if (message is from content script) {
  // Forward to sidepanel
  chrome.runtime.sendMessage(message)
} else if (message is from sidepanel) {
  // Forward to content script (in the active tab)
  chrome.tabs.sendMessage(tabId, message)
}
```

### Extension ↔ Backend Communication (HTTP)

The sidepanel's React app uses `fetch()` to call the backend API.

**Example:**
```typescript
// In sidepanel/api/client.ts
async function createWalkthrough(data, token) {
  const response = await fetch('http://localhost:3000/walkthroughs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`  // ← JWT token in header
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw error;
  return await response.json();
}
```

---

## Key Concepts You Need to Know

### 1. Element Fingerprinting

When recording, we don't just save "the button". We save a **fingerprint** — a unique description of the element.

Why? Because the page might change. If we save the exact DOM structure, the walkthrough breaks. Instead, we save multiple ways to identify the element:

```javascript
{
  id: "search-btn",              // if it has an id
  dataTestId: "my-search-button", // if it has data-testid
  ariaLabel: "Search",            // if it has aria-label
  xpath: "/html/body/button",     // complex but reliable
  classes: ["btn", "primary"],    // CSS classes
  innerText: "Search",            // visible text
  rect: { x, y, w, h }            // position on screen
}
```

**During playback**, the extension tries these in order to find the element again.

### 2. JWT (JSON Web Tokens)

When you login, the backend gives you a token. It looks like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
```

It's a secure way to prove "I'm logged in" without sending your password every time.

Every API request to the backend includes this token:
```
Authorization: Bearer <token>
```

### 3. Shadow DOM

The balloon (shown during playback) uses **Shadow DOM** — a way to isolate DOM and CSS.

Why? If the website has CSS like `* { background: red; }`, it would break our balloon. Shadow DOM is a separate DOM tree inside an element, with its own styles that don't get affected by the page's styles.

```javascript
const host = document.createElement('div');
const shadow = host.attachShadow({ mode: 'open' });
shadow.appendChild(balloonElement);
// Now balloonElement is inside shadow DOM
// Website's CSS can't touch it
```

### 4. Zustand Store

Like Redux or Context, but simpler:

```typescript
// Define store
const useStore = create((set, get) => ({
  isRecording: false,
  pendingSteps: [],
  
  startRecording() {
    set({ isRecording: true, pendingSteps: [] });
  },
  
  addPendingStep(step) {
    set(s => ({ pendingSteps: [...s.pendingSteps, step] }));
  }
}));

// Use it in React
function MyComponent() {
  const isRecording = useStore(s => s.isRecording);
  const addStep = useStore(s => s.addPendingStep);
  
  return (
    <div>
      {isRecording && <button onClick={() => addStep(...)}>Add</button>}
    </div>
  );
}
```

### 5. Offline Mode

The extension can work offline:
- When you fetch walkthroughs, it saves them to `chrome.storage.local` (browser's local storage)
- If the backend is unreachable, it falls back to the cached version
- When you're online again, it syncs

---

## Running the Project

### Setup

```bash
# Install dependencies (pnpm is like npm but faster)
pnpm install

# Start the backend (Terminal 1)
pnpm --filter backend dev
# Output: Server running at http://0.0.0.0:3000

# Build the extension (Terminal 2)
pnpm --filter extension build
# Output: Creates packages/extension/dist/
```

### Load the Extension in Chrome

1. Open `chrome://extensions`
2. Turn on "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select `packages/extension/dist/` folder
5. Extension appears in Chrome!

### Testing

1. Go to any website (e.g., `https://wikipedia.com`)
2. Click the Mini Apty icon in the top-right
3. A sidebar (side panel) opens
4. Login with any email/password (backend has no real user validation)
5. Click "+ New" → fill in title → "Start Recording"
6. Click "Capture Next Element" on the page
7. Click elements to record them
8. Click "Save Walkthrough"
9. Walkthrough is saved in the backend database

---

## The Recording Flow

### Step-by-Step What Happens

```
1. USER CLICKS "+ NEW"
   └─ Sidepanel state: view = 'list' (showing walkthrough list)

2. USER FILLS IN TITLE & CLICKS "START RECORDING"
   └─ Store: startRecording() called
   └─ Zustand state updated: isRecording = true, view = 'recording'
   └─ Message sent: START_RECORDING
   └─ Content script receives it → startElementPicker() called

3. CONTENT SCRIPT SHOWS PICKER
   └─ Floating label appears: "🎯 Click an element to capture • Esc to cancel"
   └─ Mouseover listeners active: highlights elements with blue glow

4. USER CLICKS AN ELEMENT ON PAGE
   └─ Content script's onClick fires
   └─ Element fingerprint captured via captureFingerprint()
   └─ NEW STEP CREATED:
       {
         id: "uuid",
         title: "Search" (auto-guessed from placeholder/innerText),
         description: "",
         fingerprint: { ... },
         advanceTrigger: "next-button"
       }
   └─ Message sent: STEP_CAPTURED
   └─ Content script picker RESTARTS automatically

5. SIDEPANEL RECEIVES STEP_CAPTURED
   └─ Zustand: addPendingStep(step)
   └─ RecordingPanel re-renders with new StepCard

6. USER SEES STEP IN LIST
   └─ Can edit title/description
   └─ Can select advance trigger (Next button / Click element / Input change)

7. USER REPEATS STEPS 4-6 FOR EACH ELEMENT

8. USER CLICKS "SAVE WALKTHROUGH"
   └─ Zustand: saveWalkthrough()
   └─ fetch() POST to /walkthroughs
   └─ Backend creates walkthrough in database
   └─ Backend returns walkthrough with ID
   └─ Zustand: view = 'list' (back to list)
   └─ New walkthrough appears in list
```

---

## The Playback Flow

### Step-by-Step What Happens

```
1. USER OPENS EXTENSION
   └─ Sidepanel loads
   └─ loadWalkthroughs() fetches from backend
   └─ Walkthrough list shown

2. USER CLICKS PLAY (▶ BUTTON)
   └─ startPlayer(walkthrough) called
   └─ Message sent: START_PLAYER with walkthrough data
   └─ Content script receives it

3. CONTENT SCRIPT SHOWS STEP 1
   └─ elementResolver.ts finds the actual element on the page
       (using fingerprint, trying id → data-testid → xpath → etc.)
   └─ BalloonPlayer.show() called
   └─ Balloon appears with step title/description
   └─ Blue ring highlights the element
   └─ Based on advanceTrigger:
       - "next-button": Shows "Next →" button
       - "click-target": Shows hint "👆 Click this element"
       - "input-change": Shows hint "⌨️ Type in the field"

4. BASED ON ADVANCE TRIGGER, ONE OF THREE THINGS HAPPENS:
   
   A) IF "NEXT-BUTTON" (DEFAULT)
      └─ User clicks "Next →" button on balloon
      └─ advance(1) called
      └─ Go to step 2
   
   B) IF "CLICK-TARGET"
      └─ Content script listens: element.addEventListener('click')
      └─ User clicks highlighted element on page
      └─ advance(1) called automatically
      └─ Go to step 2
   
   C) IF "INPUT-CHANGE"
      └─ Content script listens: element.addEventListener('change')
      └─ User types in field and changes its value
      └─ advance(1) called automatically
      └─ Go to step 2

5. REPEAT FOR ALL STEPS

6. ON LAST STEP
   └─ Button shows "✓ Done" instead of "Next →"
   └─ After completion → balloon closes
   └─ Message sent: PLAYER_FINISHED
   └─ Sidepanel can show "Walkthrough complete!" message
```

---

## Example: Recording a Search Form

Let's say you want to record: "How to search on Wikipedia"

### What You Do

```
1. Navigate to https://wikipedia.com
2. Click Mini Apty icon → sidebar opens
3. Click "+ New" → "Wikipedia search tutorial"
4. Click "Start Recording"
5. Click "Capture Next Element" → click on the search input
   ✓ Step 1 captured: <input> (title auto-filled as "search")
6. Edit title: "Enter your search term"
7. Click "Capture Next Element" → click on the Search button
   ✓ Step 2 captured: <button> (title auto-filled as "Search")
8. Edit title: "Click search"
9. Select advance trigger: "Click this element" (so on playback, just clicking the button advances)
10. Click "Save Walkthrough"
```

### What the Backend Stores

```json
{
  "id": "abc123",
  "userId": "user456",
  "title": "Wikipedia search tutorial",
  "origin": "https://wikipedia.com",
  "pathPattern": "/",
  "steps": [
    {
      "id": "step1",
      "title": "Enter your search term",
      "description": "",
      "fingerprint": {
        "tag": "input",
        "id": "searchInput",
        "xpath": "/html/body//input[@id='searchInput']",
        "innerText": "",
        "placeholder": "search"
      },
      "advanceTrigger": "next-button"
    },
    {
      "id": "step2",
      "title": "Click search",
      "description": "",
      "fingerprint": {
        "tag": "button",
        "xpath": "/html/body//button[contains(text(), 'Search')]",
        "innerText": "Search"
      },
      "advanceTrigger": "click-target"
    }
  ],
  "createdAt": "2026-05-15T10:30:00Z",
  "updatedAt": "2026-05-15T10:30:00Z"
}
```

### When Someone Plays It Back

```
1. They open Wikipedia, click Mini Apty
2. See "Wikipedia search tutorial" in list
3. Click play
4. Step 1/2 shown: "Enter your search term" → points to search input
5. User types "React"
6. Clicks "Next →" button (or presses Enter)
   OR if we had set advance trigger to "input-change", just typing advances
7. Step 2/2 shown: "Click search" → points to Search button
8. User clicks the button
   → Since advanceTrigger is "click-target", auto-advances to end
9. Walkthrough complete!
```

---

## Summary

| Part | Technology | Purpose |
|---|---|---|
| **Extension UI** | React + TypeScript | User interacts here (login, recording, playback controls) |
| **State Management** | Zustand | Stores logged-in user, walkthroughs list, recording state |
| **Content Script** | Vanilla JS + TypeScript | Runs on every website, captures clicks, shows balloon |
| **Service Worker** | Vanilla JS + TypeScript | Routes messages between content script and UI |
| **Backend API** | Node.js + Fastify | Handles user auth, stores walkthroughs in database |
| **Database** | SQLite + Drizzle | Stores users and walkthroughs |
| **Message Passing** | Chrome APIs | Content script ↔ Background ↔ Sidepanel communication |
| **HTTP Requests** | Fetch API | Sidepanel ↔ Backend communication |

You now know:
- What Mini Apty does
- What Chrome extensions are
- How the project is structured
- How frontend and backend talk
- How recording and playback work
- What all the new technologies mean

---

## Next Steps

- Read the code in order:
  1. `packages/extension/src/sidepanel/App.tsx` — Main React app
  2. `packages/extension/src/sidepanel/store/index.ts` — State management
  3. `packages/extension/src/content/index.ts` — Content script logic
  4. `packages/backend/src/app.ts` — Backend setup
  5. `packages/backend/src/routes/walkthroughs.ts` — API endpoints

- Run the project locally and test it
- Try modifying a feature (e.g., change the balloon's color)
- Read the `DOUBLE_CAPTURE_BUG.md` to understand how we solved a complex bug

Good luck! 🚀
