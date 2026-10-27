// Local profile UI only. Dashboard and FastAPI demo endpoints remain public.
(() => {
  const form = document.getElementById("accountForm");
  if (!form) return;
  const el = id => document.getElementById(id);
  const store = window.NetObserveProfiles;
  let mode = new URLSearchParams(location.search).get("mode") === "register" ? "register" : "signin";
  let challenge;
  let busy = false;
  function message(text, kind = "info") {
    el("authMessage").textContent = text;
    el("authMessage").dataset.kind = kind;
    el("authMessage").hidden = !text;
  }
  function newCheck() {
    const values = crypto.getRandomValues(new Uint8Array(2));
    const a = values[0] % 9 + 1;
    const b = values[1] % 9 + 1;
    challenge = {answer: a + b, expires: Date.now() + 300000};
    el("checkQuestion").textContent = `(${a} + ${b} = ?)`;
    el("checkAnswer").value = "";
  }
  function setMode(next) {
    if (busy) return;
    mode = next;
    const register = mode === "register";
    el("authTitle").textContent = register ? "Create account" : "Sign in";
    el("authSubmit").textContent = register ? "Create browser profile" : "Sign in";
    el("nameField").hidden = !register;
    el("fullName").required = register;
    el("password").autocomplete = register ? "new-password" : "current-password";
    el("signInTab").setAttribute("aria-pressed", String(!register));
    el("registerTab").setAttribute("aria-pressed", String(register));
    message("");
    if (!challenge) newCheck();
  }
  function showSession(profile) {
    form.hidden = true;
    el("sessionPanel").hidden = false;
    document.querySelector(".auth-tabs").hidden = true;
    el("authTitle").textContent = "Your workspace";
    el("sessionEmail").textContent = profile.email;
    message("");
  }
  function initialize() {
    try {
      const profile = store.session();
      if (profile) { showSession(profile); return; }
      form.hidden = false;
      el("sessionPanel").hidden = true;
      document.querySelector(".auth-tabs").hidden = false;
      if (!crypto.subtle) throw new Error("Use HTTPS or localhost for browser profiles. Explore Demo is still available.");
      el("authSubmit").disabled = false;
      setMode(mode);
    } catch {
      message("Browser profile storage is unavailable or unreadable. Explore Demo is still available.", "error");
      el("authSubmit").disabled = true;
    }
  }
  el("signInTab").addEventListener("click", () => setMode("signin"));
  el("registerTab").addEventListener("click", () => setMode("register"));
  el("refreshCheck").addEventListener("click", () => { if (!busy) newCheck(); });
  el("signOutButton").addEventListener("click", () => {
    try { store.signOut(); challenge = null; mode = "signin"; initialize(); }
    catch { message("Could not clear the browser session. Clear this site's stored data to sign out.", "error"); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || el("authSubmit").disabled || !form.reportValidity()) return;
    if (!challenge || challenge.expires <= Date.now()) {
      newCheck(); message("The local check expired. Complete the new check.", "error"); return;
    }
    if (Number(el("checkAnswer").value) !== challenge.answer) {
      message("The local check answer is incorrect. Try again.", "error"); return;
    }
    busy = true;
    el("authSubmit").disabled = true;
    el("authSubmit").textContent = "Checking...";
    try {
      const profile = mode === "register"
        ? await store.register(el("fullName").value, el("email").value, el("password").value)
        : await store.signIn(el("email").value, el("password").value);
      el("password").value = "";
      challenge = null;
      showSession(profile);
    } catch (error) {
      message(error instanceof Error ? error.message : "Could not use browser storage. Try Explore Demo.", "error");
      newCheck();
    } finally {
      busy = false;
      el("authSubmit").disabled = false;
      el("authSubmit").textContent = mode === "register" ? "Create browser profile" : "Sign in";
    }
  });
  window.addEventListener("storage", event => {
    if (!busy && event.key?.startsWith("netobserve.local")) initialize();
  });
  initialize();
})();
