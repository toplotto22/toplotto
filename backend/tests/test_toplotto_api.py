"""TOP LOTTO V2 backend API regression tests."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
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


# ----------- LOTTERIES V2 (state + session) -----------
class TestLotteries:
    def test_list_lotteries_v2_structure(self, admin_client):
        r = admin_client.get(f"{API}/lotteries")
        assert r.status_code == 200
        lotteries = r.json()
        assert isinstance(lotteries, list)
        assert len(lotteries) >= 8, f"Expected >=8 lotteries, got {len(lotteries)}"
        # All have state + session
        for lot in lotteries:
            assert "state" in lot, f"Missing state field: {lot}"
            assert "session" in lot, f"Missing session field: {lot}"
            assert lot["state"] in ("FL", "GA", "NY", "TX")
            assert lot["session"] in ("midday", "evening")
        # Should have all 4 states x 2 sessions
        pairs = {(lot["state"], lot["session"]) for lot in lotteries}
        for state in ("FL", "GA", "NY", "TX"):
            for sess in ("midday", "evening"):
                assert (state, sess) in pairs, f"Missing {state}/{sess}"
        # French names
        names = [lot["name"] for lot in lotteries]
        assert any("Midi" in n or "Soir" in n for n in names), f"Names not in French: {names}"


# ----------- SETTINGS V2 (new payout structure) -----------
class TestSettings:
    def test_get_settings_v2_payouts(self, admin_client):
        r = admin_client.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert "payouts" in s
        p = s["payouts"]
        # bolet must have premye/dezyem/twazyem/mariage
        assert p["bolet"]["premye"] == 50
        assert p["bolet"]["dezyem"] == 20
        assert p["bolet"]["twazyem"] == 10
        assert p["bolet"]["mariage"] == 500
        assert p["pick3"] == 500
        assert p["pick4"] == 5000
        assert p["pick5"] == 50000
        assert "exchange_rate_brl_to_htg" in s

    def test_update_settings_payouts(self, admin_client):
        r = admin_client.put(f"{API}/settings", json={
            "payouts": {"bolet": {"premye": 60, "dezyem": 25, "twazyem": 12, "mariage": 550},
                        "pick3": 600, "pick4": 6000, "pick5": 60000}
        })
        assert r.status_code == 200
        # restore defaults
        admin_client.put(f"{API}/settings", json={
            "payouts": {"bolet": {"premye": 50, "dezyem": 20, "twazyem": 10, "mariage": 500},
                        "pick3": 500, "pick4": 5000, "pick5": 50000}
        })


# ----------- USERS -----------
class TestUsers:
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
        pytest.test_machann_email = unique


# ----------- TICKETS V2: auto-detect game + new payouts -----------
class TestTicketsBoletPosition:
    """Bolet position 1 = premye (50x), 2 = dezyem (20x), 3 = twazyem (10x)."""

    def _create_ticket(self, admin_client, lottery_id, draw_date, items):
        r = admin_client.post(f"{API}/tickets", json={
            "lottery_id": lottery_id, "draw_date": draw_date, "currency": "HTG",
            "items": items, "customer_name": "TEST"
        })
        assert r.status_code == 200, r.text
        return r.json()

    def _set_result(self, admin_client, lottery_id, draw_date, bolet=None, pick3="", pick4="", pick5=""):
        r = admin_client.post(f"{API}/results", json={
            "lottery_id": lottery_id, "draw_date": draw_date,
            "bolet": bolet or [], "pick3": pick3, "pick4": pick4, "pick5": pick5,
        })
        assert r.status_code == 200, r.text

    def test_bolet_position_premye(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        date = (datetime.now(timezone.utc).strftime("%Y-%m-%d") + "T_p1")[:10]  # use unique date string
        # use a future unique date string to avoid collision
        date = "2099-01-01"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "bolet", "number": "32", "amount": 10}])
        self._set_result(admin_client, lot["id"], date, bolet=["32", "12", "77"])
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        assert got["has_result"] is True
        # 10 * 50 = 500
        assert got["payout_amount"] == 500, f"Expected 500, got {got['payout_amount']}"
        assert got["items"][0]["winning"] is True
        assert got["items"][0]["win_key"] == "premye"
        assert got["items"][0]["win_position"] == 1

    def test_bolet_position_dezyem(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[1]
        date = "2099-01-02"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "bolet", "number": "32", "amount": 10}])
        self._set_result(admin_client, lot["id"], date, bolet=["11", "32", "77"])
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        # 10 * 20 = 200
        assert got["payout_amount"] == 200, f"Expected 200, got {got['payout_amount']}"
        assert got["items"][0]["win_key"] == "dezyem"

    def test_bolet_position_twazyem(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[2]
        date = "2099-01-03"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "bolet", "number": "32", "amount": 10}])
        self._set_result(admin_client, lot["id"], date, bolet=["11", "22", "32"])
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        # 10 * 10 = 100
        assert got["payout_amount"] == 100, f"Expected 100, got {got['payout_amount']}"
        assert got["items"][0]["win_key"] == "twazyem"

    def test_mariage_payout(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[3]
        date = "2099-01-04"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "mariage", "number": "32-12", "amount": 5}])
        self._set_result(admin_client, lot["id"], date, bolet=["32", "12", "77"])
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        # 5 * 500 = 2500
        assert got["payout_amount"] == 2500, f"Expected 2500, got {got['payout_amount']}"
        assert got["items"][0]["win_key"] == "mariage"

    def test_mariage_loses_if_only_one_match(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[4]
        date = "2099-01-05"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "mariage", "number": "32-99", "amount": 5}])
        self._set_result(admin_client, lot["id"], date, bolet=["32", "12", "77"])
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        assert got["payout_amount"] == 0
        assert got["items"][0]["winning"] is False

    def test_pick3_payout(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[5]
        date = "2099-01-06"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "pick3", "number": "932", "amount": 5}])
        self._set_result(admin_client, lot["id"], date, pick3="932")
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        # 5 * 500 = 2500
        assert got["payout_amount"] == 2500
        assert got["items"][0]["winning"] is True

    def test_pick4_payout(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[6]
        date = "2099-01-07"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "pick4", "number": "8034", "amount": 2}])
        self._set_result(admin_client, lot["id"], date, pick4="8034")
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        # 2 * 5000 = 10000
        assert got["payout_amount"] == 10000

    def test_pick5_payout(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[7]
        date = "2099-01-08"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "pick5", "number": "12345", "amount": 1}])
        self._set_result(admin_client, lot["id"], date, pick5="12345")
        got = admin_client.get(f"{API}/tickets/{t['ticket_number']}").json()
        # 1 * 50000 = 50000
        assert got["payout_amount"] == 50000

    def test_pay_flow_and_double_pay_rejected(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        date = "2099-02-01"
        t = self._create_ticket(admin_client, lot["id"], date, [{"game": "bolet", "number": "55", "amount": 10}])
        self._set_result(admin_client, lot["id"], date, bolet=["55", "00", "00"])
        # pay
        r = admin_client.post(f"{API}/tickets/{t['ticket_number']}/pay")
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 500
        # pay twice
        r2 = admin_client.post(f"{API}/tickets/{t['ticket_number']}/pay")
        assert r2.status_code == 400

    def test_cancel_unpaid_then_block_paid(self, admin_client):
        # V3: super_admin CAN now cancel paid tickets (reverses payment).
        # Non-super-admin (e.g. role 'admin') still gets 400 on paid tickets.
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        date = "2099-02-02"
        # unpaid cancel OK
        t1 = self._create_ticket(admin_client, lot["id"], date, [{"game": "bolet", "number": "01", "amount": 5}])
        r = admin_client.delete(f"{API}/tickets/{t1['ticket_number']}")
        assert r.status_code == 200
        # paid: create an 'admin' (non-super) user; they should be blocked with 400
        admin_email = f"v3_admin_{uuid.uuid4().hex[:6]}@toplotto.ht"
        cr = admin_client.post(f"{API}/users", json={
            "email": admin_email, "password": "Pass123!", "name": "V3 admin", "role": "admin"
        })
        assert cr.status_code == 200, cr.text
        lr = requests.post(f"{API}/auth/login", json={"email": admin_email, "password": "Pass123!"})
        assert lr.status_code == 200
        admin_only = requests.Session()
        admin_only.headers.update({"Authorization": f"Bearer {lr.json()['token']}"})

        t2 = self._create_ticket(admin_client, lot["id"], date, [{"game": "bolet", "number": "77", "amount": 10}])
        self._set_result(admin_client, lot["id"], date, bolet=["77", "00", "00"])
        admin_client.post(f"{API}/tickets/{t2['ticket_number']}/pay")
        # non-super-admin must still be blocked
        r2 = admin_only.delete(f"{API}/tickets/{t2['ticket_number']}")
        assert r2.status_code == 400, f"Non-super-admin should be 400 on paid, got {r2.status_code} {r2.text}"
        # super_admin now CAN cancel paid (V3) - reverses payment
        r3 = admin_client.delete(f"{API}/tickets/{t2['ticket_number']}")
        assert r3.status_code == 200, f"super_admin paid cancel should succeed, got {r3.status_code} {r3.text}"


# ----------- RESULTS V2 (string single fields) -----------
class TestResultsV2:
    def test_upsert_and_get_results(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        date = "2099-03-01"
        r = admin_client.post(f"{API}/results", json={
            "lottery_id": lot["id"], "draw_date": date,
            "pick3": "932", "pick4": "8034", "pick5": "12345",
            "bolet": ["32", "12", "77"]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["pick3"] == "932"
        assert d["pick4"] == "8034"
        assert d["bolet"] == ["32", "12", "77"]
        # GET by date
        r2 = admin_client.get(f"{API}/results", params={"draw_date": date})
        assert r2.status_code == 200
        lst = r2.json()
        assert any(x.get("pick3") == "932" and x.get("pick4") == "8034" for x in lst)


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


# ----------- AUTHORIZATION -----------
class TestAuthorization:
    def test_anon_protected_returns_401(self, anon_client):
        for path in ["/dashboard/stats", "/tickets", "/lotteries", "/settings", "/agencies"]:
            r = anon_client.get(f"{API}{path}")
            assert r.status_code == 401, f"{path} -> {r.status_code}"
