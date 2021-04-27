const HEADER_SPDY = "x-firefox-spdy";
const HEADER_HTTP3 = "x-firefox-http3";
const RESOURCE_TYPE_MAIN_FRAME = "main_frame";

type HttpProtocol = { name: string; version?: string };

const state: { [key: number]: HttpProtocol | undefined } = {};

function setState(tabId: number, protocol: HttpProtocol) {
  state[tabId] = protocol;
  setPageAction(tabId);
}

function getHttp2Protocol(headerValue?: string): HttpProtocol {
  if (headerValue && headerValue.match(/^h2/)) {
    return { name: "HTTP/2" };
  } else if (headerValue === "3.1") {
    return { name: "SPDY", version: "3.1" };
  } else if (headerValue === "3") {
    return { name: "SPDY", version: "3" };
  } else if (headerValue === "2") {
    return { name: "SPDY", version: "2" };
  } else {
    return { name: "SPDY" };
  }
}

function setPageAction(tabId: number) {
  const protocol = state[tabId];

  if (!protocol) {
    browser.pageAction.hide(tabId);
  } else {
    browser.pageAction.show(tabId);
    browser.pageAction.setIcon({
      tabId: tabId,
      path: getIcon(protocol),
    });
    browser.pageAction.setTitle({
      tabId: tabId,
      title: getTitle(protocol),
    });
  }
}

function getIcon(protocol: HttpProtocol): string {
  switch (protocol.name) {
    case "HTTP/3":
      return "icons/action-http3.svg";
    case "HTTP/2":
      return "icons/action-http2.svg";
    case "SPDY":
      return "icons/action-spdy.svg";
    default:
      return "icons/action-default.svg";
  }
}

function getTitle(protocol: HttpProtocol): string {
  let version = protocol.name;
  if (protocol.version) {
    version += " (" + protocol.version + ")";
  }

  return browser.i18n.getMessage("pageActionTitle", version);
}

browser.webRequest.onHeadersReceived.addListener(
  (e) => {
    if (e.tabId === -1 || e.type !== RESOURCE_TYPE_MAIN_FRAME) {
      return;
    }

    for (const header of e.responseHeaders || []) {
      switch (header.name.toLowerCase()) {
        case HEADER_HTTP3:
          setState(e.tabId, { name: "HTTP/3", version: header.value });
          return;
        case HEADER_SPDY:
          setState(e.tabId, getHttp2Protocol(header.value));
          return;
      }
    }

    const statusLineVersion = e.statusLine.split(" ", 2)[0];
    setState(e.tabId, { name: statusLineVersion });
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
  state[tabId] = undefined;
});
