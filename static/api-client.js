/* Shared transport: checked responses, bounded cold-start retries, no mock fallback. */
(() => {
  const pending = new Map();
  const failures = new Map();
  let initialized = false;
  let loadingTimer;
  let slowRequest = false;
  let disclosure;
  let banner;
  let message;
  let retry;
  function renderState() {
    if (!document.body) return;
    if (!disclosure) {
      disclosure = document.createElement("small");
      disclosure.id = "telemetry-disclosure";
      disclosure.textContent = "Simulated telemetry from dataset samples";
      disclosure.style.cssText = "display:block;padding:6px 18px;background:#f1f5f9;color:#475569;font:12px system-ui;";
      document.body.prepend(disclosure);
    }
    if (failures.size) {
      const endpoints = [...failures.values()].join(", ");
      ui(`Unable to load ${endpoints}. Other API requests may still work. Displayed values may be stale. Check your connection or retry.`, true);
    } else if (pending.size && (!initialized || slowRequest)) {
      ui("Connecting to backend. Render may need a minute to wake up.");
    } else if (banner) {
      banner.style.display = "none";
    }
  }
  function ui(text, failed = false) {
    if (!document.body) return;
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "api-connection-status";
      banner.setAttribute("role", "status");
      banner.style.cssText = "position:sticky;top:0;z-index:10000;background:#fff7df;color:#563d0b;padding:12px 20px;font:14px system-ui;border-bottom:1px solid #dfc98d;display:flex;gap:16px;align-items:center;";
      message = document.createElement("span");
      retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry connection";
      retry.onclick = () => location.reload();
      banner.append(message, retry);
      document.body.prepend(banner);
    }
    banner.style.display = "flex";
    message.textContent = text;
    retry.hidden = !failed;
  }
  async function request(path, options = {}) {
    const base = window.NETOBSERVE_CONFIG.apiBaseUrl.replace(/\/$/, "");
    const url = new URL(path, base || location.origin);
    const endpoint = `${options.method || "GET"} ${url.pathname}`;
    const key = (options.method || "GET") === "GET"
      ? `GET ${url}` : Symbol("request");
    if (pending.has(key)) return (await pending.get(key)).clone();
    const operation = Promise.resolve().then(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(url, {...options, credentials: "omit", signal: controller.signal});
          if (!response.ok) {
            const error = new Error(`Request failed (${response.status})`);
            error.retryable = response.status === 429 || response.status >= 500;
            throw error;
          }
          if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Backend returned an unexpected response");
          const data = await response.clone().json();
          if (url.pathname === "/stream" && !Array.isArray(data.devices)) throw new Error("Invalid telemetry response");
          if (url.pathname === "/topology-data" && (!Array.isArray(data.nodes) || !Array.isArray(data.edges))) throw new Error("Invalid topology response");
          if (url.pathname === "/self-healing-data" && !Array.isArray(data.devices)) throw new Error("Invalid remediation response");
          if (url.pathname === "/predict" && (typeof data.risk_score !== "number" || !data.risk_level)) throw new Error("Invalid prediction response");
          failures.delete(endpoint);
          return response;
        } catch (error) {
          // POST prediction is never replayed automatically.
          if (attempt === 3 || (options.method || "GET") !== "GET" || error.retryable === false) {
            failures.set(endpoint, endpoint);
            throw error;
          }
          slowRequest = true;
          renderState();
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        } finally { clearTimeout(timeout); }
      }
    });
    const wasIdle = pending.size === 0;
    pending.set(key, operation);
    if (wasIdle) {
      slowRequest = false;
      loadingTimer = setTimeout(() => {
        slowRequest = true;
        renderState();
      }, 700);
    }
    renderState();
    try { return (await operation).clone(); }
    finally {
      pending.delete(key);
      if (!pending.size) {
        clearTimeout(loadingTimer);
        slowRequest = false;
        if (!failures.size) initialized = true;
      }
      renderState();
    }
  }
  window.NetObserveAPI = {fetch: request};
})();
