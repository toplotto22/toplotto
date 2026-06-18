"""V8 tests: multi-lottery tickets + duplicate ticket + PDF lang."""
import os
import httpx
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = httpx.post(f"{API}/auth/login", json={"email": "admin@toplotto.com", "password": "Admin@1000"})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def lotteries(admin_token):
    r = httpx.get(f"{API}/lotteries", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    return r.json()


class TestMultiLottery:
    def test_create_multi_lottery_ticket(self, admin_token, lotteries):
        import datetime
        ids = [lotteries[0]["id"], lotteries[1]["id"], lotteries[2]["id"]]
        r = httpx.post(f"{API}/tickets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "lottery_ids": ids,
                "draw_date": datetime.date.today().isoformat(),
                "currency": "BRL",
                "items": [
                    {"game": "bolet", "number": "17", "amount": 10},
                    {"game": "pick3", "number": "456", "amount": 5},
                ],
            })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["lottery_ids"] == ids
        assert len(body["lottery_names"]) == 3
        # total = (10 + 5) * 3 = 45
        assert body["total"] == 45.0
        # primary lottery_id kept for back-compat
        assert body["lottery_id"] == ids[0]
        return body["ticket_number"]

    def test_create_legacy_single_lottery_still_works(self, admin_token, lotteries):
        import datetime
        r = httpx.post(f"{API}/tickets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "lottery_id": lotteries[0]["id"],
                "draw_date": datetime.date.today().isoformat(),
                "currency": "BRL",
                "items": [{"game": "bolet", "number": "23", "amount": 8}],
            })
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 8.0
        assert body["lottery_ids"] == [lotteries[0]["id"]]

    def test_no_lottery_returns_400(self, admin_token):
        import datetime
        r = httpx.post(f"{API}/tickets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "draw_date": datetime.date.today().isoformat(),
                "currency": "BRL",
                "items": [{"game": "bolet", "number": "17", "amount": 10}],
            })
        assert r.status_code == 400


class TestDuplicate:
    def test_duplicate_endpoint(self, admin_token, lotteries):
        import datetime
        # Create source ticket
        r = httpx.post(f"{API}/tickets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "lottery_ids": [lotteries[0]["id"], lotteries[1]["id"]],
                "draw_date": datetime.date.today().isoformat(),
                "currency": "BRL",
                "items": [{"game": "bolet", "number": "42", "amount": 5}],
            })
        src = r.json()
        # Duplicate
        r2 = httpx.post(f"{API}/tickets/{src['ticket_number']}/duplicate",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert r2.status_code == 200
        dup = r2.json()
        assert dup["ticket_number"] != src["ticket_number"]
        assert len(dup["items"]) == 1
        assert dup["items"][0]["number"] == "42"
        assert dup["lottery_ids"] == src["lottery_ids"]
        assert dup["total"] == src["total"]

    def test_duplicate_404(self, admin_token):
        r = httpx.post(f"{API}/tickets/TL_DOES_NOT_EXIST/duplicate",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 404


class TestPdfLang:
    def test_pdf_kreyol_default(self, admin_token, lotteries):
        import datetime
        r = httpx.post(f"{API}/tickets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "lottery_id": lotteries[0]["id"],
                "draw_date": datetime.date.today().isoformat(),
                "currency": "BRL",
                "items": [{"game": "bolet", "number": "55", "amount": 3}],
            })
        num = r.json()["ticket_number"]
        # Default lang (ht)
        r1 = httpx.get(f"{API}/tickets/{num}/pdf",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert r1.status_code == 200
        assert r1.headers["content-type"] == "application/pdf"
        assert len(r1.content) > 50000  # has logo + QR
        # French
        r2 = httpx.get(f"{API}/tickets/{num}/pdf?lang=fr",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert r2.status_code == 200
        # Should produce different PDF (different labels embedded)
        assert r2.content != r1.content
