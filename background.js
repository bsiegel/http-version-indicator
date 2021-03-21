const STATE_NONE = "none";
const STATE_MIXED = "mixed";
const HEADER_SPDY = "x-firefox-spdy";
const HEADER_HTTP3 = "x-firefox-http3";
const RESOURCE_TYPE_MAIN_FRAME = "main_frame";
const RESOURCE_TYPE_SUB_FRAME = "sub_frame";

const state = {};

function evaluateState(tabId, resourceType, headerName, headerValue) {
  if (resourceType === RESOURCE_TYPE_MAIN_FRAME) {
    updateState(tabId, getVersion(headerName, headerValue));
  } else if (
    state[tabId] === STATE_NONE &&
    getVersion(headerName, headerValue) !== STATE_NONE
  ) {
    updateState(tabId, STATE_MIXED);
  }
}

function getVersion(headerName, headerValue) {
  if (headerName === HEADER_HTTP3) {
    return "HTTP/3 (" + headerValue + ")";
  }

  if (headerName === HEADER_SPDY) {
    if (headerValue.match(/^h2/)) {
      return "HTTP/2 (" + headerValue + ")";
    } else if (headerValue === "3.1") {
      return "SPDY (v3.1)";
    } else if (headerValue === "3") {
      return "SPDY (v3)";
    } else if (headerValue === "2") {
      return "SPDY (v2)";
    } else {
      return "SPDY";
    }
  }

  return STATE_NONE;
}

function updateState(tabId, version) {
  state[tabId] = version;
  setPageAction(tabId);
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
      path: getIcon(version)
    });
    browser.pageAction.setTitle({
      tabId: tabId,
      title: getTitle(version)
    });
  }
}

function getIcon(version) {
  if (version === STATE_MIXED) {
    return "icons/icon-gray.svg";
  } else if (version.startsWith("HTTP/3")) {
    return "icons/icon-orange.svg";
  } else if (version.startsWith("HTTP/2")) {
    return "icons/icon-blue.svg";
  } else if (version.startsWith("SPDY")) {
    return "icons/icon-green.svg";
  }
  return null;
}

function getTitle(version) {
  if (version === STATE_MIXED) {
    return browser.i18n.getMessage("pageActionTitleMixed");
  } else {
    return browser.i18n.getMessage("pageActionTitle", version);
  }
}

browser.webRequest.onHeadersReceived.addListener(
  e => {
    if (
      e.tabId === -1 ||
      (e.type !== RESOURCE_TYPE_MAIN_FRAME &&
        e.type !== RESOURCE_TYPE_SUB_FRAME)
    ) {
      return;
    }

    for (let header of e.responseHeaders) {
      let headerName = header.name.toLowerCase();
      if (headerName === HEADER_SPDY || headerName === HEADER_HTTP3) {
        evaluateState(e.tabId, e.type, headerName, header.value);
        return;
      }
    }
    evaluateState(e.tabId, e.type);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

browser.webNavigation.onCommitted.addListener(e => {
  if (e.frameId === 0) {
    setPageAction(e.tabId);
  }
});

browser.tabs.onActivated.addListener(e => {
  setPageAction(e.tabId);
});

browser.tabs.onRemoved.addListener(tabId => {
  state[tabId] = null;
});
