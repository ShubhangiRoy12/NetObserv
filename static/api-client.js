/* Shared transport: checked responses, bounded cold-start retries, no mock fallback. */
(() => {
  const pending = new Map();
  const failures = new Map();
  const succeeded = new Set();
  const required = new Set();
  const listeners = new Set();
  const requests = new Map();
  const activeEndpoints = new Map();
  let initialized = false;
  let disclosure;
  let banner;
  let message;
  let retry;
  function getState() {
    const retrying = [...failures.keys()].some(endpoint => activeEndpoints.has(endpoint));
    const known = new Set([...required, ...succeeded]);
    const allUnavailable = known.size && [...known].every(endpoint => failures.has(endpoint));
    const state = failures.size ? (retrying ? "reconnecting" : allUnavailable || !succeeded.size ? "unavailable" : "degraded")
      : initialized ? "connected" : "connecting";
    return {state, pending: pending.size, failures: [...failures.values()]};
  }
  function renderState() {
    if (!document.body) return;
    if (!disclosure) {
      disclosure = document.createElement("small");
      disclosure.id = "telemetry-disclosure";
      disclosure.textContent = "Simulated telemetry from dataset samples";
      disclosure.style.cssText = "display:block;padding:6px 18px;background:#f1f5f9;color:#475569;font:12px system-ui;";
      document.body.prepend(disclosure);
    }
    const snapshot = getState();
    for (const listener of listeners) {
      try { listener(snapshot); } catch (error) { console.error(error); }
    }
    if (failures.size) {
      const endpoints = [...failures.values()].join(", ");
      const recovery = snapshot.state === "reconnecting" ? "Reconnecting automatically. " : "Temporarily unavailable. ";
      ui(`${recovery}Unable to load ${endpoints}. Check your connection; if this persists, check backend availability and allowed origins. Failed predictions must be resubmitted.`, true);
    } else if (pending.size && !initialized) {
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
      retry.onclick = () => retryFailed();
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
    requests.set(endpoint, {path: url.href, options});
    if (!initialized && !required.size) required.add(endpoint);
    const key = (options.method || "GET") === "GET"
      ? `GET ${url}` : Symbol("request");
    if (pending.has(key)) return (await pending.get(key)).clone();
    const operation = Promise.resolve().then(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(url, {...options, cache: "no-store", credentials: "omit", signal: controller.signal});
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
          succeeded.add(endpoint);
          if ([...required].every(item => succeeded.has(item))) initialized = true;
          return response;
        } catch (error) {
          // POST prediction is never replayed automatically.
          if (attempt === 3 || (options.method || "GET") !== "GET" || error.retryable === false) {
            const reason = error.name === "AbortError" ? "Request timed out after 20 seconds" : error.message;
            failures.set(endpoint, `${endpoint}: ${reason}`);
            throw error;
          }
          failures.set(endpoint, `${endpoint}: ${error.message}. Retrying (${attempt + 1}/3)`);
          renderState();
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        } finally { clearTimeout(timeout); }
      }
    });
    pending.set(key, operation);
    activeEndpoints.set(endpoint, (activeEndpoints.get(endpoint) || 0) + 1);
    renderState();
    try { return (await operation).clone(); }
    finally {
      pending.delete(key);
      const remaining = activeEndpoints.get(endpoint) - 1;
      if (remaining) activeEndpoints.set(endpoint, remaining);
      else activeEndpoints.delete(endpoint);
      renderState();
    }
  }
  function retryFailed() {
    return Promise.allSettled([...failures.keys()]
      .filter(endpoint => endpoint.startsWith("GET "))
      .map(endpoint => {
        const saved = requests.get(endpoint);
        return request(saved.path, saved.options);
      }));
  }
  window.NetObserveAPI = {
    fetch: request,
    getState,
    retryFailed,
    requireEndpoints(paths) {
      for (const path of paths) required.add(`GET ${new URL(path, location.origin).pathname}`);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    }
  };
  window.addEventListener?.("online", () => retryFailed());
})();
