/* Browser-only demo profiles. This does not authenticate requests to FastAPI. */
(() => {
  const PROFILES = "netobserve.localProfiles.v1";
  const SESSION = "netobserve.localSession.v1";
  const ITERATIONS = 600000;
  const LIFETIME = 7 * 24 * 60 * 60 * 1000;
  const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
  function profiles() {
    const saved = JSON.parse(localStorage.getItem(PROFILES) || "[]");
    if (!Array.isArray(saved)) throw new Error("Browser profile storage is unreadable.");
    return saved;
  }
  function normalize(email) { return String(email).trim().toLowerCase(); }
  async function hash(password, saltHex) {
    if (!/^[a-f0-9]{32}$/.test(saltHex)) throw new Error("Invalid browser profile.");
    if (!crypto.subtle) throw new Error("Browser sign-in requires HTTPS or localhost.");
    const salt = Uint8Array.from(saltHex.match(/../g), pair => parseInt(pair, 16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return hex(new Uint8Array(await crypto.subtle.deriveBits({
      name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256"
    }, key, 256)));
  }
  function startSession(profile) {
    const session = {profileId: profile.id, expiresAt: Date.now() + LIFETIME};
    localStorage.setItem(SESSION, JSON.stringify(session));
    return {email: profile.email, name: profile.name};
  }
  function session() {
    const saved = JSON.parse(localStorage.getItem(SESSION) || "null");
    if (!saved) return null;
    if (!Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now() || saved.expiresAt > Date.now() + LIFETIME) {
      localStorage.removeItem(SESSION);
      return null;
    }
    const profile = profiles().find(item => item.id === saved.profileId);
    if (!profile) { localStorage.removeItem(SESSION); return null; }
    return {email: profile.email, name: profile.name};
  }
  async function register(name, email, password) {
    email = normalize(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email.");
    if (!String(name).trim() || String(name).length > 100) throw new Error("Enter your name.");
    if (password.length < 12 || password.length > 128) throw new Error("Use a password between 12 and 128 characters.");
    if (profiles().some(item => item.email === email)) throw new Error("This browser already has that profile. Sign in instead.");
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await hash(password, salt);
    // Re-read after hashing so another tab's changes are not overwritten.
    const saved = profiles();
    if (saved.some(item => item.email === email)) throw new Error("This profile was already created. Sign in instead.");
    if (saved.length >= 20) throw new Error("This browser has reached its demo profile limit.");
    const profile = {id: crypto.randomUUID(), name: String(name).trim(), email, salt, passwordHash};
    localStorage.setItem(PROFILES, JSON.stringify([...saved, profile]));
    return startSession(profile);
  }
  async function signIn(email, password) {
    if (password.length > 128) throw new Error("Email or password is incorrect.");
    const profile = profiles().find(item => item.email === normalize(email));
    if (!profile || await hash(password, profile.salt) !== profile.passwordHash) throw new Error("Email or password is incorrect.");
    return startSession(profile);
  }
  window.NetObserveProfiles = {session, register, signIn, signOut: () => localStorage.removeItem(SESSION)};
})();
