# Separate Render frontend and backend

The frontend is plain HTML, CSS and JavaScript. FastAPI previously returned the
HTML files directly; there is no Jinja template processing. The audited static
folder now uses relative local assets and page links, and a shared API client.
Its index.html is the browser-profile entrance. dashboard.html contains the dashboard.
Explore Demo is a plain link and works without JavaScript or authentication.
login.html is a small compatibility redirect to the entrance for old bookmarks.

## Render Static Site settings

Connect the same repository and branch as the backend. Enter:

- Root Directory: static
- Build Command: echo "Static frontend ready"
- Publish Directory: .

No npm install or frontend compilation is needed. HTML pages are
served as files. Do not add an SPA rewrite. Open / for the demo entrance.
Old /static/... bookmarks belong to the backend; static-site navigation uses
/dashboard.html, /predict.html, /topology.html and the other .html page paths.

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

The dashboard initializes with GET /health, /model-metrics and /stream. Its sidebar
and banner share the client's connecting, connected, reconnecting, degraded and unavailable
states. Unavailable is displayed as temporarily unavailable. Normal pending refreshes do not change a connected state. A failed request
shows its endpoint and error, including during retry; a successful health request
does not clear an error from another endpoint. The simulation disclosure is separate.
Dashboard polling starts five seconds after each healthy batch completes, avoiding overlapping
refreshes when inference takes more than five seconds. Failed batches back off to
10, 20, 40 and at most 60 seconds between batches. Health successes are reused for
30 seconds and metrics for five minutes; failures are retried on the next batch.
The Retry connection button reissues failed GETs without navigation, and returning
online also triggers recovery. POST predictions are never replayed automatically.
Last-received telemetry is marked stale after a stream error or 30 seconds without
a sample; successful stream responses clear the stale indication. Network errors
do not reveal whether CORS, connectivity, or a hosting restart caused them.
The transport uses no-store so recovery requires actual API responses. Local script URLs carry a
release query version; bump it with client changes to bypass stale script caches.

Run frontend state regressions with node tests/check_api_client.cjs.
Run browser-profile storage regressions with node tests/check_local_profiles.cjs.

The entrance supports browser-only demo profiles stored in localStorage. Passwords
are hashed with Web Crypto PBKDF2-HMAC-SHA256, 600,000 iterations and a random
16-byte salt. Plaintext passwords are not stored or sent to a server. Users should
use demo passwords, not passwords used elsewhere. Sessions last seven days and
returning sessions skip the local arithmetic check. That check is a UI demo, not
verified CAPTCHA or bot protection. There is no email verification or password
recovery. Profiles do not synchronize across devices or browser origins and are
lost when site storage is cleared. Other people with browser/storage access can
alter these profiles or sessions; this is not backend authorization. The dashboard
and FastAPI demo endpoints remain public. No external account service is integrated.
Real private data would need server-verified auth. CORS is not authentication.
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
