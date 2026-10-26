/* Shared transport: checked responses, bounded cold-start retries, no mock fallback. */
(() => {
  const pending = new Map();
  const failures = new Set();
  let banner;
  let message;
  let retry;
  function ui(text, failed = false) {
    if (!document.body) return;
    if (!banner) {
      banner = document.createElement("div");
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
    const key = (options.method || "GET") === "GET"
      ? `GET ${url}` : Symbol("request");
    if (pending.has(key)) return (await pending.get(key)).clone();
    const operation = (async () => {
      ui("Connecting to backend. Render may need a minute to wake up. Telemetry is simulated.");
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
          failures.delete(key);
          return response;
        } catch (error) {
          // POST prediction is never replayed automatically.
          if (attempt === 3 || (options.method || "GET") !== "GET" || error.retryable === false) {
            failures.add(key);
            throw error;
          }
          ui(`Backend unavailable or waking up. Retrying (${attempt + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        } finally { clearTimeout(timeout); }
      }
    })();
    pending.set(key, operation);
    try { return (await operation).clone(); }
    finally {
      pending.delete(key);
      if (failures.size) ui("Backend unavailable. Displayed values may be stale; no new data received. Check connection or retry.", true);
      else if (!pending.size && banner) banner.style.display = "none";
    }
  }
  window.NetObserveAPI = {fetch: request};
})();
