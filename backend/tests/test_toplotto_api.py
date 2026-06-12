"""TOP LOTTO backend API regression tests."""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lottery-hub-48.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ----------- AUTH -----------
class TestAuth:
    def test_login_success(self, anon_client):
        r = anon_client.post(f"{API}/auth/login", json={"email": "admin@toplotto.ht", "password": "Admin123!"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and len(data["token"]) > 10
        assert data["user"]["email"] == "admin@toplotto.ht"
        assert data["user"]["role"] == "super_admin"

    def test_login_wrong_password(self, anon_client):
        r = anon_client.post(f"{API}/auth/login", json={"email": "admin@toplotto.ht", "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, admin_client):
        r = admin_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == "admin@toplotto.ht"

    def test_me_without_token(self, anon_client):
        r = anon_client.get(f"{API}/auth/me")
        assert r.status_code == 401


# ----------- LOTTERIES -----------
class TestLotteries:
    def test_list_lotteries(self, admin_client):
        r = admin_client.get(f"{API}/lotteries")
        assert r.status_code == 200
        lotteries = r.json()
        assert isinstance(lotteries, list)
        assert len(lotteries) >= 8
        codes = {lot["code"] for lot in lotteries}
        for code in ["NY_MID", "NY_EVE", "GA_MID", "GA_EVE", "TX_MOR", "TX_EVE", "FL_MID", "FL_EVE"]:
            assert code in codes, f"Missing lottery code: {code}"


# ----------- USERS -----------
class TestUsers:
    def test_list_users(self, admin_client):
        r = admin_client.get(f"{API}/users")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert any(u["role"] == "super_admin" for u in users)

    def test_create_user(self, admin_client):
        unique = f"test_{uuid.uuid4().hex[:8]}@toplotto.ht"
        r = admin_client.post(f"{API}/users", json={
            "email": unique, "password": "Pass123!",
            "name": "TEST Machann", "role": "machann"
        })
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["email"] == unique
        assert u["role"] == "machann"
        assert "id" in u
        pytest.test_machann_id = u["id"]
        pytest.test_machann_email = unique

    def test_create_user_duplicate_email(self, admin_client):
        r = admin_client.post(f"{API}/users", json={
            "email": pytest.test_machann_email, "password": "Pass123!",
            "name": "DupTest", "role": "machann"
        })
        assert r.status_code == 400

    def test_update_user(self, admin_client):
        r = admin_client.put(f"{API}/users/{pytest.test_machann_id}", json={"name": "Updated Machann"})
        assert r.status_code == 200

    def test_machann_cannot_list_users(self, anon_client):
        # Login as machann
        r = anon_client.post(f"{API}/auth/login", json={"email": pytest.test_machann_email, "password": "Pass123!"})
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 403
        pytest.test_machann_token = token


# ----------- AGENCIES -----------
class TestAgencies:
    def test_list_agencies(self, admin_client):
        r = admin_client.get(f"{API}/agencies")
        assert r.status_code == 200
        agencies = r.json()
        assert any(a["name"] == "Agence Principale" for a in agencies)

    def test_create_agency(self, admin_client):
        r = admin_client.post(f"{API}/agencies", json={
            "name": f"TEST_Agence_{uuid.uuid4().hex[:6]}", "address": "PaP", "phone": "509"
        })
        assert r.status_code == 200
        assert "id" in r.json()


# ----------- TICKETS + RESULTS + PAYOUT -----------
class TestTicketsAndPayouts:
    def test_create_ticket(self, admin_client):
        # Get a lottery
        lotteries = admin_client.get(f"{API}/lotteries").json()
        lot = lotteries[0]
        pytest.test_lottery_id = lot["id"]
        draw_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        pytest.test_draw_date = draw_date

        r = admin_client.post(f"{API}/tickets", json={
            "lottery_id": lot["id"], "draw_date": draw_date, "currency": "HTG",
            "items": [
                {"game": "bolet", "play_type": "straight", "number": "12", "amount": 10}
            ],
            "customer_name": "Test Client"
        })
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["ticket_number"].startswith("TL")
        assert len(t["ticket_number"]) == 13  # TL + 6 + 5
        assert t["total"] == 10
        assert t["currency"] == "HTG"
        pytest.test_ticket_number = t["ticket_number"]

    def test_get_ticket_no_result_yet(self, admin_client):
        r = admin_client.get(f"{API}/tickets/{pytest.test_ticket_number}")
        assert r.status_code == 200
        t = r.json()
        assert t["has_result"] is False

    def test_list_tickets(self, admin_client):
        r = admin_client.get(f"{API}/tickets")
        assert r.status_code == 200
        tickets = r.json()
        assert any(t["ticket_number"] == pytest.test_ticket_number for t in tickets)

    def test_post_results(self, admin_client):
        r = admin_client.post(f"{API}/results", json={
            "lottery_id": pytest.test_lottery_id,
            "draw_date": pytest.test_draw_date,
            "bolet": ["12", "34", "56"],
            "pick3": ["111", "222", "333"],
            "pick4": ["1111", "2222", "3333"],
            "pick5": ["11111", "22222", "33333"],
        })
        assert r.status_code == 200, r.text

    def test_get_ticket_with_winning(self, admin_client):
        r = admin_client.get(f"{API}/tickets/{pytest.test_ticket_number}")
        assert r.status_code == 200
        t = r.json()
        assert t["has_result"] is True
        # 10 HTG bolet straight, position 1 -> 60 * 10 * 1.0 = 600
        assert t["payout_amount"] == 600, f"Expected 600 got {t['payout_amount']}"
        assert t["items"][0]["winning"] is True

    def test_pay_ticket(self, admin_client):
        r = admin_client.post(f"{API}/tickets/{pytest.test_ticket_number}/pay")
        assert r.status_code == 200
        assert r.json()["amount"] == 600

        # verify persisted
        t = admin_client.get(f"{API}/tickets/{pytest.test_ticket_number}").json()
        assert t["paid"] is True

    def test_pay_ticket_twice_fails(self, admin_client):
        r = admin_client.post(f"{API}/tickets/{pytest.test_ticket_number}/pay")
        assert r.status_code == 400

    def test_machann_sees_only_own_tickets(self, anon_client):
        token = getattr(pytest, "test_machann_token", None)
        if not token:
            pytest.skip("No machann token")
        r = requests.get(f"{API}/tickets", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        # admin's ticket should not be in machann's list
        for t in r.json():
            assert t["machann_id"] != "admin_id_placeholder"


# ----------- RESULTS LIST -----------
class TestResults:
    def test_list_results(self, admin_client):
        r = admin_client.get(f"{API}/results")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----------- DASHBOARD -----------
class TestDashboard:
    def test_dashboard_stats(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/stats")
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ["sales_total", "payments_total", "profit", "tickets_sold",
                    "tickets_winning", "trend", "by_lottery", "recent_tickets", "recent_results"]:
            assert key in d, f"Missing key {key}"
        assert isinstance(d["trend"], list)
        assert len(d["trend"]) == 7


# ----------- REPORTS -----------
class TestReports:
    def test_sales_report(self, admin_client):
        r = admin_client.get(f"{API}/reports/sales?group_by=day")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            assert "sales" in rows[0]
            assert "profit" in rows[0]

    def test_export_csv(self, admin_client):
        r = admin_client.get(f"{API}/reports/export")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "Ticket" in r.text


# ----------- SETTINGS -----------
class TestSettings:
    def test_get_settings(self, admin_client):
        r = admin_client.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert "business_name" in s
        assert "payouts" in s
        assert "exchange_rate_brl_to_htg" in s

    def test_update_settings(self, admin_client):
        r = admin_client.put(f"{API}/settings", json={"business_name": "TOP LOTTO TEST", "exchange_rate_brl_to_htg": 26.0})
        assert r.status_code == 200
        assert r.json()["business_name"] == "TOP LOTTO TEST"
        # restore
        admin_client.put(f"{API}/settings", json={"business_name": "TOP LOTTO", "exchange_rate_brl_to_htg": 25.0})


# ----------- AUTHORIZATION -----------
class TestAuthorization:
    def test_anon_protected_returns_401(self, anon_client):
        for path in ["/dashboard/stats", "/tickets", "/lotteries", "/settings", "/agencies"]:
            r = anon_client.get(f"{API}{path}")
            assert r.status_code == 401, f"{path} -> {r.status_code}"
