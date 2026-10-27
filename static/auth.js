// Demo entry only. No identity or access control is claimed here.
document.getElementById("loginForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  window.location.href = "./dashboard.html";
});
document.getElementById("signupForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  window.location.href = "./dashboard.html";
});
