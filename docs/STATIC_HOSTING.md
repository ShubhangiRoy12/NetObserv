# Separate Render frontend and backend

The frontend is plain HTML, CSS and JavaScript. FastAPI previously returned the
HTML files directly; there is no Jinja template processing. The audited static
folder now uses relative local assets and page links, and a shared API client.
Its index.html is the dashboard. login.html is an optional public demo entrance.

## Render Static Site settings

Connect the same repository and branch as the backend. Enter:

- Root Directory: static
- Build Command: echo "Static frontend ready"
- Publish Directory: .

No npm install or frontend compilation is needed. All eight HTML pages are
served as files. Do not add an SPA rewrite. Open /login.html for the demo entrance.
Old /static/... bookmarks belong to the backend; static-site navigation uses
/index.html, /predict.html, /topology.html and the other .html page paths.

## Backend setup

Keep the existing Web Service and its build and start commands unchanged.
After Render assigns the Static Site URL, add this environment variable to the
existing backend and redeploy it:

    CORS_ALLOWED_ORIGINS=https://YOUR-STATIC-SITE.onrender.com

Use the exact origin with scheme, no path. Multiple explicit origins may be
comma-separated, including a custom domain or http://localhost:5500 for testing.
Wildcard origins are rejected. Until this is configured, cross-origin requests
from the new site are expected to be blocked. Existing backend pages still work.

## Configuration and behavior

static/config.js is public runtime configuration. Its default backend is
https://netobserv.onrender.com. Pages on the existing backend domain, or local
ports 8000/8001, use the same origin. To use another backend edit apiBaseUrl in
that file and redeploy; plain static files do not read Render environment variables.
Never put API secrets in JavaScript.

The shared client checks HTTP status and JSON responses. GET requests have up to
four 20-second attempts with 2/4/6-second retry delays. Concurrent requests for
the same endpoint share the in-flight request. Prediction POSTs are not replayed.
A visible status banner explains waking, failure, stale values and manual retry.
No fallback telemetry is fabricated. The server's simulated stream is preserved.

There is no real authentication in this repository. The previous browser flag
did not verify identity or protect the API. The entrance is now explicitly a
public demo with no credential collection or fake registration success. CORS is
not authentication; add server-verified identity before handling private data.
Browser alert history remains specific to each browser origin and does not
automatically transfer from the old site to the new site.

## Verification

    py -3.10 -m pytest -q
    py -3.10 -m http.server 5500 --directory static

For local cross-origin testing, allow http://localhost:5500 on the backend and
point config.js to the backend being tested. Check dashboard, devices, topology,
analytics, prediction and supervised healing. Confirm blocked origins fail CORS,
failed responses show errors, and the retry button recovers after backend startup.
Deploy backend changes first, then the Static Site. No hosting deployment is
performed by these repository changes.
