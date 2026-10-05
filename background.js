chrome.webRequest.onBeforeRequest.addListener((details) => {
      if (details.url.includes("https://neetcode.io/api/executeCodeFunctionHttp")) {
        try {
          const requestBody = details.requestBody;
          const buffer = requestBody.raw[0].bytes;
          const uint8Array = new Uint8Array(buffer);
          const decoder = new TextDecoder('utf-8');
          const decodedString = decoder.decode(uint8Array);
          const data = JSON.parse(decodedString);
          const title = data.data.problemId;
          const code = data.data.rawCode;

          chrome.tabs.sendMessage(details.tabId, {
              type: 'CODE_DATA',
              title: title,
              code: code
          });
        } catch (error) {
          console.error(error);
        }
      }
    },
    { urls: ["https://neetcode.io/api/executeCodeFunctionHttp*"] },
    ["requestBody"]
);

chrome.webRequest.onBeforeRequest.addListener((details) => {
    const url = new URL(details.url);
    const problem = url.pathname.match(/^\/problems\/([a-z0-9-]+)\/submit\/$/);
    if (details.method !== 'POST' || !problem || details.tabId < 0) return;

    try {
        const decoder = new TextDecoder('utf-8');
        const chunks = details.requestBody?.raw;
        if (!chunks?.length || chunks.some(chunk => !chunk.bytes)) return;
        const body = chunks.map(chunk => decoder.decode(chunk.bytes, { stream: true })).join('') + decoder.decode();
        const data = JSON.parse(body);
        if (typeof data.typed_code !== 'string' || !data.typed_code.trim() || typeof data.lang !== 'string') return;

        chrome.tabs.sendMessage(details.tabId, {
            type: 'LEETCODE_CODE_DATA',
            title: problem[1],
            code: data.typed_code,
            language: data.lang
        }, { frameId: 0 }).catch(error => console.error(error));
    } catch (error) {
        console.error(error);
    }
}, { urls: ['https://leetcode.com/problems/*/submit/'] }, ['requestBody']);

// Restores the content script in supported tabs that are already open, since
// Chrome injects it on page load only.
chrome.runtime.onInstalled.addListener(async () => {
    const tabs = await chrome.tabs.query({ url: ["https://neetcode.io/*", "https://leetcode.com/*"] });
    for (const tab of tabs) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ["content-script.js", "config.js"]
            });
        } catch (error) {
            console.error(error);
        }
    }
});
