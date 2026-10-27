import importlib
import re
from pathlib import Path
from urllib.parse import unquote

from fastapi.testclient import TestClient

from netobserve import api

STATIC = Path(__file__).resolve().parents[1] / 'static'


def test_static_local_links_and_assets_exist():
    for page in STATIC.glob('*.html'):
        text = page.read_text(encoding='utf-8')
        if page.name not in ('index.html', 'login.html', 'signup.html'):
            assert './config.js' in text and './api-client.js' in text
        assert '/static/' not in text
        for target in re.findall(r'(?:src|href)="([^"]+)"', text):
            if target.startswith(('https:', 'http:', '#')):
                continue
            assert (STATIC / unquote(target.split('?')[0])).is_file(), (page, target)


def test_homepage_has_browser_profiles_and_plain_demo_link():
    entrance = (STATIC / 'index.html').read_text(encoding='utf-8')
    assert 'Sign in' in entrance
    assert 'href="./dashboard.html"' in entrance
    assert 'id="accountForm"' in entrance
    assert 'local-profiles.js' in entrance
    assert 'Explore Demo' in entrance
    assert 'Browser-only profile' in entrance
    assert '7 days' not in entrance
    assert 'id="deviceTableBody"' not in entrance
    for filename in ('dashboard.html', 'devices.html', 'analytics.html', 'predict.html', 'topology.html', 'self-healing.html'):
        text = (STATIC / filename).read_text(encoding='utf-8')
        assert re.search(r'href="\./dashboard.html">Dashboard</a>', text)


def test_cors_preflight_explicit_origin(monkeypatch):
    monkeypatch.setenv('CORS_ALLOWED_ORIGINS', 'https://netobserve-ui.example')
    module = importlib.reload(api)
    try:
        client = TestClient(module.app)
        allowed = client.options('/predict', headers={
            'Origin': 'https://netobserve-ui.example',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
        })
        assert allowed.status_code == 200
        assert allowed.headers['access-control-allow-origin'] == 'https://netobserve-ui.example'
        denied = client.options('/predict', headers={
            'Origin': 'https://untrusted.example',
            'Access-Control-Request-Method': 'POST',
        })
        assert denied.status_code == 400
        assert 'access-control-allow-origin' not in denied.headers
        assert client.get('/login', follow_redirects=False).headers['location'] == '/static/index.html'
        assert client.get('/static/login.html').status_code == 200
        assert 'id="accountForm"' in client.get('/').text
        assert 'href="./dashboard.html"' in client.get('/static/index.html').text
        assert 'id="deviceTableBody"' in client.get('/static/dashboard.html').text
    finally:
        monkeypatch.delenv('CORS_ALLOWED_ORIGINS', raising=False)
        importlib.reload(api)
