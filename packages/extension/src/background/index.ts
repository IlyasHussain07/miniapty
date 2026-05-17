import type { AnyMessage, MessageToContent } from '../shared/messages';

// Open side panel when user clicks the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const CONTENT_TYPES = new Set([
  'STEP_CAPTURED', 'RECORDING_STOPPED', 'PLAYER_STEP_CHANGED', 'PLAYER_FINISHED',
]);

const SIDEPANEL_TYPES = new Set([
  'START_RECORDING', 'STOP_RECORDING', 'START_PLAYER', 'PLAYER_NEXT', 'PLAYER_PREV', 'STOP_PLAYER',
]);

// Track tabs where we have already injected the content script this session.
// Prevents injecting twice if the first send failed for a transient reason.
const injectedTabs = new Set<number>();

async function sendToTab(tabId: number, message: MessageToContent): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    if (injectedTabs.has(tabId)) {
      // Already injected once but still can't reach it (restricted page, crashed, etc.)
      chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_UNAVAILABLE' }).catch(() => {});
      return;
    }
    // Content script not present yet (tab was open before extension loaded).
    // Inject once from the manifest's file list, then retry.
    const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
    if (files.length === 0) {
      chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_UNAVAILABLE' }).catch(() => {});
      return;
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files });
      injectedTabs.add(tabId);
      await new Promise(r => setTimeout(r, 80));
      await chrome.tabs.sendMessage(tabId, message).catch(() => {
        chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_UNAVAILABLE' }).catch(() => {});
      });
    } catch {
      // Restricted page (chrome://, devtools, etc.)
      chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_UNAVAILABLE' }).catch(() => {});
    }
  }
}

// Clear injection record when a tab navigates so we can inject again on the next load.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') injectedTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((message: AnyMessage, sender, sendResponse) => {
  if (CONTENT_TYPES.has(message.type)) {
    // Only forward messages that came from a content script (sender.tab is set).
    // Ignoring messages from extension pages prevents accidental re-broadcast loops.
    if (sender.tab) chrome.runtime.sendMessage(message).catch(() => {});
  } else if (SIDEPANEL_TYPES.has(message.type)) {
    // Side panel → active tab content script
    const tabId = sender.tab?.id;
    if (tabId) {
      sendToTab(tabId, message as MessageToContent);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id) sendToTab(tabs[0].id, message as MessageToContent);
      });
    }
  }
  sendResponse({ ok: true });
  return true;
});

// Notify side panel when the active tab navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.runtime.sendMessage({ type: 'TAB_UPDATED', url: tab.url, tabId }).catch(() => {});
  }
});
