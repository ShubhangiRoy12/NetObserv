// LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", (e) => {

        e.preventDefault();

        localStorage.setItem("netobserv_logged_in", "true");

        window.location.href = "/static/index.html";
    });
}


// SIGNUP
const signupForm = document.getElementById("signupForm");

if (signupForm) {

    signupForm.addEventListener("submit", (e) => {

        e.preventDefault();

        alert("Account created successfully");

        window.location.href = "/login";
    });
}