<<<<<<< HEAD
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
=======
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
>>>>>>> 29145c1d3f19ab501e3bd754b1c5750b570409f8
}