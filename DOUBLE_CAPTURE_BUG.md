# Double Capture Bug — Investigation & Resolution

## The Problem

When clicking a single element on a page during recording mode, two identical steps were being added to the pending steps list instead of one.

**Example of what the user saw:**

```
Step 1 — <span>
  Wikipedia
  Advance: Next button click

Step 2 — <span>
  Wikipedia
  Advance: Next button click
```

Both steps had the exact same element, same title, and same fingerprint — caused by one physical mouse click.

---

## Root Causes

Several independent causes were identified, each of which could produce duplicates on its own.

### 1. Two Content Script Instances Running Simultaneously

**What happened:**  
Chrome MV3 extensions inject content scripts in two ways:
- Automatically via the `manifest.json` `content_scripts` declaration (runs on every page load)
- Programmatically via `chrome.scripting.executeScript` (used as a fallback when `chrome.tabs.sendMessage` fails)

When the extension was rebuilt and reloaded in `chrome://extensions` but the browser tab was **not** reloaded, the old content script from the previous build continued running. When the user then clicked "Capture Next Element", the background's fallback injection code ran `executeScript`, creating a **second** content script instance in the same tab.

Both instances registered `chrome.runtime.onMessage` listeners. Both received the `START_RECORDING` message. Both started the element picker. One physical click triggered both pickers — producing two `STEP_CAPTURED` messages and two steps.

**Why the guard didn't help initially:**  
The injection guard (`globalThis.__miniAptyInjected`) was added to the new build. But the old content script (already running from before the guard existed) had never set this flag, so when the new script was injected, it saw the flag as `undefined`, set it to `true`, and ran fully — alongside the old instance.

---

### 2. Browser Synthetic Click Events (Label → Input)

**What happened:**  
When an HTML `<label>` element is associated with an `<input>` (via `for` attribute or by wrapping), clicking the label causes the browser to dispatch **two separate click events**:
1. A click on the `<label>` element itself
2. A synthetic click on the linked `<input>` element, fired automatically by the browser

The element picker listens to `click` events in the capture phase at the `document` level. It received both events and tried to capture both, resulting in two steps.

---

### 3. Background Script Re-broadcasting to Itself

**What happened:**  
The background service worker's `onMessage` listener received `STEP_CAPTURED` from the content script and re-broadcast it to the sidepanel using `chrome.runtime.sendMessage`. In some Chrome versions, this re-broadcast could also trigger the background's own `onMessage` listener again, causing a second re-broadcast to the sidepanel — which meant `addPendingStep` was called twice.

---

## Fixes Applied

### Fix 1 — Injection Guard in the Content Script

A flag on `globalThis` ensures only the first instance of the content script runs its code. Any subsequent injection (from the scripting API fallback) becomes a no-op.

**File:** `packages/extension/src/content/index.ts`

```typescript
const g = globalThis as typeof globalThis & { __miniAptyInjected?: boolean };
if (g.__miniAptyInjected) {
  // Already running — do nothing.
} else {
  g.__miniAptyInjected = true;
  // ... all content script logic
}
```

---

### Fix 2 — One-time Injection Tracking in the Background

A `Set<number>` (`injectedTabs`) tracks which tabs have already been injected this service worker session. If `sendMessage` fails and we inject, the tab ID is recorded. Any subsequent failure for the same tab raises `CONTENT_SCRIPT_UNAVAILABLE` instead of injecting again.

**File:** `packages/extension/src/background/index.ts`

```typescript
const injectedTabs = new Set<number>();

async function sendToTab(tabId: number, message: MessageToContent): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    if (injectedTabs.has(tabId)) {
      chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_UNAVAILABLE' }).catch(() => {});
      return;
    }
    // inject once, mark as injected, retry
    const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
    await chrome.scripting.executeScript({ target: { tabId }, files });
    injectedTabs.add(tabId);
    await new Promise(r => setTimeout(r, 80));
    await chrome.tabs.sendMessage(tabId, message).catch(() => {});
  }
}

// Clear record on navigation so future page loads can be injected normally
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') injectedTabs.delete(tabId);
});
```

---

### Fix 3 — Sender Filter in Background Re-broadcast

The background now only forwards `STEP_CAPTURED` (and other `CONTENT_TYPES` messages) to the sidepanel when the sender is an actual content script — identified by `sender.tab` being defined. Messages from extension pages (like the sidepanel itself) are ignored, preventing any re-broadcast loop.

**File:** `packages/extension/src/background/index.ts`

```typescript
if (CONTENT_TYPES.has(message.type)) {
  if (sender.tab) {   // ← only forward from content scripts
    chrome.runtime.sendMessage(message).catch(() => {});
  }
}
```

---

### Fix 4 — 300ms Delay on the Click Listener in the Picker

When the element picker activates, there is a 300ms window before the click listener is attached. This absorbs the page-focus click that occurs when the user switches from the sidepanel to the page tab — without this delay, that first focus-switch click would immediately capture an unintended element.

**File:** `packages/extension/src/content/recorder/elementPicker.ts`

```typescript
// mouseover and keydown attached immediately (for highlighting + Esc)
document.addEventListener('mouseover', onMouseOver, true);
document.addEventListener('keydown', onKeyDown, true);

// Click listener delayed to absorb the page-focus click
let clickTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
  clickTimer = null;
  document.addEventListener('click', onClick, true);
}, 300);
```

---

### Fix 5 — Capture Lock in the Content Script

A `captureLocked` boolean prevents re-entry into the `onCapture` callback within 300ms of a successful capture. This handles any synthetic click pairs (label → input) that arrive in rapid succession.

An XPath + timestamp check provides a second layer, rejecting any capture of the exact same element within 400ms.

**File:** `packages/extension/src/content/index.ts`

```typescript
let captureLocked = false;
let lastCapturedXpath = '';
let lastCaptureMs = 0;

onCapture: fp => {
  const now = Date.now();
  if (captureLocked) return;
  if (fp.xpath === lastCapturedXpath && now - lastCaptureMs < 400) return;

  captureLocked = true;
  lastCapturedXpath = fp.xpath;
  lastCaptureMs = now;
  setTimeout(() => { captureLocked = false; }, 300);

  // ... create and send step
},
```

---

### Fix 6 — Deduplication in the Zustand Store

As a final safety net, `addPendingStep` in the store compares the incoming step's XPath against the last recorded step. If the same XPath arrives within 500ms, the duplicate is silently discarded.

**File:** `packages/extension/src/sidepanel/store/index.ts`

```typescript
addPendingStep: step => set(s => {
  const now = Date.now();
  if (
    step.fingerprint.xpath === s._lastCapturedXpath &&
    now - s._lastCapturedMs < 500
  ) {
    return s; // duplicate — discard
  }
  return {
    pendingSteps: [...s.pendingSteps, step],
    _lastCapturedXpath: step.fingerprint.xpath,
    _lastCapturedMs: now,
  };
}),
```

---

## Summary of Defence Layers

| Layer | Where | Guards Against |
|---|---|---|
| Injection guard (`__miniAptyInjected`) | Content script entry | Second script instance running |
| `injectedTabs` Set | Background service worker | Re-injecting the same tab twice |
| `sender.tab` filter | Background `onMessage` | Re-broadcast loop from extension pages |
| 300ms click listener delay | Element picker | Focus-switch click captured unintentionally |
| `captureLocked` + XPath+time check | Content script `onCapture` | Synthetic label→input double-click |
| XPath+time dedup | Zustand `addPendingStep` | Any duplicate that passes all prior layers |

Each fix addresses a different failure mode. Together they ensure one physical click produces exactly one recorded step regardless of the page structure, extension reload state, or Chrome version.
