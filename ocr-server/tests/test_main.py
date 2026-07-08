import pytest

from fastapi import FastAPI

import main
from main import app, extract_structured_data


def _route_paths():
    return {route.path for route in app.routes if hasattr(route, "path")}


def test_app_is_fastapi_instance():
    assert isinstance(app, FastAPI)


def test_app_title():
    assert app.title == "YomiToku OCR Server"


def test_app_openapi_is_buildable():
    schema = app.openapi()
    assert "/health" in schema["paths"]
    assert "/ocr" in schema["paths"]


def test_health_route_registered():
    assert "/health" in _route_paths()


def test_ocr_route_registered():
    assert "/ocr" in _route_paths()


def test_health_endpoint_reports_healthy():
    from fastapi.testclient import TestClient

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["yomitoku_available"] == (main.ocr is not None)


def test_ocr_endpoint_returns_503_when_yomitoku_unavailable(monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setattr(main, "ocr", None)
    client = TestClient(app)
    response = client.post(
        "/ocr",
        files={"file": ("sample.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "YomiToku not available"


def test_extract_returns_expected_keys():
    result = extract_structured_data("何もないテキスト", None)
    assert isinstance(result, dict)
    assert set(result.keys()) == {"rawText", "date", "totalAmount", "confidence"}


def test_extract_raw_text_preserved():
    text = "請求書サンプル"
    assert extract_structured_data(text, None)["rawText"] == text


def test_extract_date_japanese_format():
    text = "請求書 2024年03月15日"
    assert extract_structured_data(text, None)["date"] == "2024年03月15日"


def test_extract_date_slash_format():
    text = "Date: 2024/03/15"
    assert extract_structured_data(text, None)["date"] == "2024/03/15"


def test_extract_date_none_when_absent():
    assert extract_structured_data("金額のみ記載", None)["date"] is None


def test_extract_amount_single():
    assert extract_structured_data("合計 2,500円", None)["totalAmount"] == 2500


def test_extract_amount_picks_max():
    text = "小計 1,000円 税 100円 合計 1,100円"
    assert extract_structured_data(text, None)["totalAmount"] == 1100


def test_extract_amount_none_when_absent():
    assert extract_structured_data("金額の記載なし", None)["totalAmount"] is None


def test_extract_strips_yen_symbol():
    assert extract_structured_data("¥3,000", None)["totalAmount"] == 3000


def test_extract_confidence_is_constant():
    assert extract_structured_data("テキスト", None)["confidence"] == 0.85
