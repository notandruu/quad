import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("quad_agent.py")
SPEC = importlib.util.spec_from_file_location("quad_agent", MODULE_PATH)
quad_agent = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(quad_agent)


def test_extract_target_url_from_message():
    assert (
        quad_agent.extract_target_url("audit https://example.com/security please")
        == "https://example.com/security"
    )


def test_extract_target_url_falls_back_to_default():
    assert quad_agent.extract_target_url("audit the demo") == quad_agent.DEFAULT_TARGET_URL


def test_format_quad_summary():
    assert "run: run_1" in quad_agent.format_quad_summary(
        {
            "summary": {
                "runId": "run_1",
                "status": "needs_approval",
                "targetUrl": "https://example.com",
                "artifacts": [{"id": "a1"}],
                "approvals": [{"id": "ap1"}],
                "receipts": [{"status": "ready"}],
                "nextAction": "approve packet",
            }
        }
    )
