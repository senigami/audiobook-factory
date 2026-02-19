import pytest
from bs4 import BeautifulSoup
from pathlib import Path

def test_start_button_fidelity():
    index_path = Path("templates/index.html")
    content = index_path.read_text()
    soup = BeautifulSoup(content, 'html.parser')
    
    # Check XTTS form
    xtts_form = soup.find('form', id='startXttsForm')
    assert xtts_form is not None, "Form with id 'startXttsForm' not found"
    assert not xtts_form.has_attr('action'), "XTTS form should not have an 'action' attribute"
    assert not xtts_form.has_attr('method'), "XTTS form should not have a 'method' attribute"
    
    # All XTTS elements should be present
    assert soup.find('select', id='speakerProfileSelect') is not None
    
    # Check AJAX listeners
    assert "document.getElementById('startXttsForm')?.addEventListener('submit'" in content
    assert "refreshJobs()" in content
    assert "refreshJobList()" not in content, "Legacy function name refreshJobList found"
