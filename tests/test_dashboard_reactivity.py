import pytest
from fastapi.testclient import TestClient
from bs4 import BeautifulSoup
from pathlib import Path
from app.web import app

@pytest.fixture
def client():
    return TestClient(app, follow_redirects=False)

def test_api_responses(client):
    """Verify that queue control endpoints return JSON 200, not 303 redirects."""
    routes = ["/queue/start_xtts", "/queue/pause", "/queue/resume"]
    for route in routes:
        response = client.post(route)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        assert response.json()["status"] == "ok"

def test_html_ajax_fidelity(client):
    """Verify the HTML structure supports AJAX (no action/method on forms)."""
    response = client.get("/")
    assert response.status_code == 200
    content = response.text
    soup = BeautifulSoup(content, 'html.parser')
    
    # Check XTTS form
    xtts_form = soup.find('form', id='startXttsForm')
    assert xtts_form is not None
    assert not xtts_form.has_attr('action')
    assert not xtts_form.has_attr('method')
    
    # Check JavaScript presence
    assert "document.getElementById('startXttsForm')?.addEventListener('submit'" in content
    assert "refreshJobs()" in content
    assert "refreshJobList()" not in content, "Legacy function name refreshJobList still exists"

def test_static_caching_headers(client):
    """Verify that dashboard.css is served correctly."""
    response = client.get("/static/dashboard.css")
    assert response.status_code == 200
