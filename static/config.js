// Public configuration, never put secrets here. Empty apiBaseUrl uses same origin.
window.NETOBSERVE_CONFIG = Object.freeze({
  apiBaseUrl: location.hostname === "netobserv.onrender.com" || location.port === "8001" || location.port === "8000"
    ? "" : "https://netobserv.onrender.com"
});
