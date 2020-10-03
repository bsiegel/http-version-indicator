const STATE_NONE = "none";
const STATE_MIXED = "mixed";
const HEADER_SPDY = "x-firefox-spdy";
const RESOURCE_TYPE_MAIN_FRAME = "main_frame";
const RESOURCE_TYPE_SUB_FRAME = "sub_frame";

const state = {};

function evaluateState(tabId, resourceType, header) {
  if (resourceType === RESOURCE_TYPE_MAIN_FRAME) {
    updateState(tabId, getVersion(header));
  } else if (state[tabId] === STATE_NONE && getVersion(header) !== STATE_NONE) {
    updateState(tabId, STATE_MIXED);
  }
}

function getVersion(header) {
  if (header === STATE_NONE) {
    return STATE_NONE;
  } else if (header.match(/^h2/)) {
    return "HTTP/2";
  } else if (header === "3.1") {
    return "SPDY 3.1";
  } else if (header === "3") {
    return "SPDY 3";
  } else if (header === "2") {
    return "SPDY 2";
  } else {
    return "SPDY";
  }
}

function updateState(tabId, version) {
  state[tabId] = version;
  setPageAction(tabId, version);
}

function setPageAction(tabId) {
  let version = state[tabId];
  if (!version) {
    return;
  }

  if (version === STATE_NONE) {
    browser.pageAction.hide(tabId);
  } else {
    browser.pageAction.show(tabId);
    browser.pageAction.setIcon({
      tabId: tabId,
      path: getIcon(version),
    });
    browser.pageAction.setTitle({
      tabId: tabId,
      title: getTitle(version),
    });
  }
}

function getIcon(version) {
  if (version === STATE_MIXED) {
    return "icons/icon-gray.svg";
  } else if (version === "HTTP/2") {
    return "icons/icon-blue.svg";
  } else {
    return "icons/icon-green.svg";
  }
}

function getTitle(version) {
  if (version === STATE_MIXED) {
    return browser.i18n.getMessage("pageActionTitleMixed");
  } else {
    return browser.i18n.getMessage("pageActionTitle", version);
  }
}

browser.webRequest.onHeadersReceived.addListener(
  (e) => {
    if (
      e.tabId === -1 ||
      (e.type !== RESOURCE_TYPE_MAIN_FRAME &&
        e.type !== RESOURCE_TYPE_SUB_FRAME)
    ) {
      return;
    }

    for (let header of e.responseHeaders) {
      if (header.name.toLowerCase() === HEADER_SPDY) {
        evaluateState(e.tabId, e.type, header.value);
        return;
      }
    }

    evaluateState(e.tabId, e.type, STATE_NONE);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.webNavigation.onCommitted.addListener((e) => {
  if (e.frameId === 0) {
    setPageAction(e.tabId);
  }
});

browser.tabs.onActivated.addListener((e) => {
  setPageAction(e.tabId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  state[tabId] = null;
});
