chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "ping") {
        // Simple ping response to test if content script is responsive
        sendResponse({ pong: true });
        return true;
    }
    
    if (message.action === "duolingo_api") {
        const { url, method, headers, body } = message;
        console.log("[ContentScript] Fetching:", url, method, headers, body);
        fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include"
        })
        .then(async (response) => {
            const text = await response.text();
            console.log("[ContentScript] Response:", response.status, Array.from(response.headers.entries()), text);
            sendResponse({
                ok: response.ok,
                status: response.status,
                headers: Array.from(response.headers.entries()),
                body: text
            });
        })
        .catch((err) => {
            console.error("[ContentScript] Fetch error:", err);
            sendResponse({ ok: false, error: err.message });
        });
        return true; // Giữ message port mở cho sendResponse bất đồng bộ
    }
});