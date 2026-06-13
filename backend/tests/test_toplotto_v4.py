"""
TOP LOTTO V4 — Backend tests for:
- Lottery v4 fields (timezone, local_time, external IDs)
- PUT /api/lotteries/{id} permissions
- POST /api/results/import (external API integration)
- Sales window enforcement (is_sales_open)
- Auto recompute on POST /api/results
- User commission_percent CRUD
- GET /api/machann/commission
- GET /api/tickets/{n}/pdf
"""
import time
from datetime import datetime, timezone, timedelta
import requests
import pytest

BASE = None  # set in fixture


# ---------- Helpers ----------
def _login(base_url, email, password):
    r = requests.post(f"{base_url}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- 1) Lottery v4 schema ----------
class TestLotterySchema:
    def test_list_lotteries_has_v4_fields(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/lotteries")
        assert r.status_code == 200
        lots = r.json()
        assert len(lots) >= 8, f"Expected >=8 lotteries, got {len(lots)}"
        required = ["timezone", "local_time", "close_offset_minutes", "external_pick3_id", "external_pick4_id"]
        codes = {l.get("code") for l in lots}
        for c in ("FL_MID", "FL_EVE", "GA_MID", "GA_EVE", "NY_MID", "NY_EVE", "TX_MID", "TX_EVE"):
            assert c in codes, f"Missing lottery code {c}"
        for l in lots:
            if l["code"] in ("FL_MID", "FL_EVE", "GA_MID", "GA_EVE", "NY_MID", "NY_EVE", "TX_MID", "TX_EVE"):
                for f in required:
                    assert f in l and l[f] is not None, f"Lottery {l['code']} missing {f}: {l}"


# ---------- 2) PUT /api/lotteries/{id} ----------
class TestLotteryUpdatePermission:
    def test_super_admin_can_update(self, admin_client, base_url):
        r = admin_client.get(f"{base_url}/api/lotteries")
        lots = r.json()
        target = next(l for l in lots if l["code"] == "FL_MID")
        original = target["local_time"]
        # Update
        r = admin_client.put(f"{base_url}/api/lotteries/{target['id']}", json={"local_time": "14:00"})
        assert r.status_code == 200, r.text
        # Verify
        r = admin_client.get(f"{base_url}/api/lotteries")
        lots = r.json()
        updated = next(l for l in lots if l["id"] == target["id"])
        assert updated["local_time"] == "14:00"
        # restore
        admin_client.put(f"{base_url}/api/lotteries/{target['id']}", json={"local_time": original})

    def test_non_super_admin_403(self, admin_client, base_url):
        # Create a directeur user
        email = f"v4_dir_{int(time.time())}@toplotto.ht"
        r = admin_client.post(f"{base_url}/api/users", json={
            "email": email, "password": "Pass123!", "name": "Dir V4", "role": "directeur"
        })
        assert r.status_code == 200, r.text
        token = _login(base_url, email, "Pass123!")
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        # Get any lottery
        lots = admin_client.get(f"{base_url}/api/lotteries").json()
        lid = lots[0]["id"]
        r = s.put(f"{base_url}/api/lotteries/{lid}", json={"local_time": "10:00"})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ---------- 3) POST /api/results/import ----------
class TestResultsImport:
    def test_import_external_results(self, admin_client, base_url):
        r = admin_client.post(f"{base_url}/api/results/import?date=2026-06-12")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "imported" in body
        assert "errors" in body
        assert isinstance(body["errors"], list)
        # External API may be flaky — tolerate but require at least 1 import
        assert body["imported"] >= 1, f"No results imported: {body}"

        # Verify results were stored
        r = admin_client.get(f"{base_url}/api/results", params={"draw_date": "2026-06-12"})
        assert r.status_code == 200
        results = r.json()
        assert len(results) >= 1, "No results stored after import"
        # At least one result must have pick3 (string) + bolet
        with_pick3 = [r for r in results if isinstance(r.get("pick3"), str) and r.get("pick3")]
        assert len(with_pick3) >= 1, f"No pick3 string values: {results}"
        # Verify bolet[0] derived from pick3 last 2 digits for at least one
        match_found = False
        for res in with_pick3:
            if res.get("bolet") and isinstance(res["bolet"], list) and res["bolet"][0]:
                if res["bolet"][0] == res["pick3"][-2:]:
                    match_found = True
                    break
        assert match_found, f"No bolet[0]==pick3[-2:] match in any result: {with_pick3}"


# ---------- 4) Sales window enforcement ----------
class TestSalesWindow:
    def test_tomorrow_always_succeeds(self, admin_client, base_url):
        lots = admin_client.get(f"{base_url}/api/lotteries").json()
        lottery = lots[0]
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        r = admin_client.post(f"{base_url}/api/tickets", json={
            "lottery_id": lottery["id"], "draw_date": tomorrow, "currency": "BRL",
            "items": [{"game": "bolet", "number": "00", "amount": 1}],
            "customer_name": "TEST_v4_tomorrow",
        })
        assert r.status_code == 200, f"Tomorrow ticket should succeed: {r.text}"

    def test_today_past_window_blocked(self, admin_client, base_url):
        """Find a lottery whose local draw is TODAY (in its tz) and has already passed close.
        Use the lottery's LOCAL date as draw_date (matching real product flow)."""
        from zoneinfo import ZoneInfo
        lots = admin_client.get(f"{base_url}/api/lotteries").json()
        past_lottery = None
        local_date = None
        utc_today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        for l in lots:
            tz = ZoneInfo(l.get("timezone", "America/New_York"))
            hh, mm = map(int, l["local_time"].split(":"))
            now_local = datetime.now(tz)
            today_draw = now_local.replace(hour=hh, minute=mm, second=0, microsecond=0)
            close_at = today_draw - timedelta(minutes=l.get("close_offset_minutes", 5))
            ld = now_local.strftime("%Y-%m-%d")
            # Server checks draw_date == UTC today. Only relevant if local_date == UTC today.
            if now_local >= close_at and ld == utc_today:
                past_lottery = l
                local_date = ld
                break
        if not past_lottery:
            pytest.skip("No lottery with local_date==utc_today has passed sales window")
        r = admin_client.post(f"{base_url}/api/tickets", json={
            "lottery_id": past_lottery["id"], "draw_date": local_date, "currency": "BRL",
            "items": [{"game": "bolet", "number": "00", "amount": 1}],
            "customer_name": "TEST_v4_past",
        })
        assert r.status_code == 400, f"Expected 400 'Vente fermée' for {past_lottery['code']}, got {r.status_code}: {r.text}"
        assert "fermée" in r.text.lower() or "ferme" in r.text.lower() or "trop" in r.text.lower()


# ---------- 5) Auto recompute on POST /api/results ----------
class TestAutoRecompute:
    def test_results_post_updates_existing_tickets(self, admin_client, base_url):
        lots = admin_client.get(f"{base_url}/api/lotteries").json()
        lottery = lots[0]
        future = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%d")
        # Create ticket with bolet number "32" amount 10
        r = admin_client.post(f"{base_url}/api/tickets", json={
            "lottery_id": lottery["id"], "draw_date": future, "currency": "BRL",
            "items": [{"game": "bolet", "number": "32", "amount": 10}],
            "customer_name": "TEST_v4_recompute",
        })
        assert r.status_code == 200, r.text
        ticket_number = r.json()["ticket_number"]

        # POST results with bolet[0]=32 (premye)
        r = admin_client.post(f"{base_url}/api/results", json={
            "lottery_id": lottery["id"], "draw_date": future,
            "pick3": "", "pick4": "", "pick5": "", "bolet": ["32", "12", "77"],
        })
        assert r.status_code == 200, r.text

        # Fetch tickets LIST (not detail) and confirm payout_amount + has_result
        r = admin_client.get(f"{base_url}/api/tickets", params={"lottery_id": lottery["id"]})
        assert r.status_code == 200
        tix = r.json()
        found = next((t for t in tix if t["ticket_number"] == ticket_number), None)
        assert found is not None, f"Ticket {ticket_number} not in list"
        # premye payout = 10 * 50 = 500
        assert found.get("payout_amount") == 500.0, f"Expected payout_amount=500.0, got {found.get('payout_amount')}: {found}"
        assert found.get("has_result") is True, f"has_result not set: {found}"

        # Cleanup
        admin_client.delete(f"{base_url}/api/tickets/{ticket_number}?hard=true")


# ---------- 6) commission_percent ----------
class TestCommissionPercent:
    def test_create_user_with_commission(self, admin_client, base_url):
        email = f"v4_com_{int(time.time())}@toplotto.ht"
        r = admin_client.post(f"{base_url}/api/users", json={
            "email": email, "password": "Pass123!", "name": "Com V4",
            "role": "machann", "commission_percent": 5.5,
        })
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        assert r.json().get("commission_percent") == 5.5

        # GET /users
        r = admin_client.get(f"{base_url}/api/users")
        users = r.json()
        u = next(u for u in users if u["id"] == uid)
        assert u.get("commission_percent") == 5.5

        # PUT update
        r = admin_client.put(f"{base_url}/api/users/{uid}", json={"commission_percent": 10})
        assert r.status_code == 200, r.text
        u = next(u for u in admin_client.get(f"{base_url}/api/users").json() if u["id"] == uid)
        assert u.get("commission_percent") == 10


# ---------- 7) GET /api/machann/commission ----------
class TestMachannCommission:
    def test_machann_commission_endpoint(self, admin_client, base_url):
        # Create machann with 5% commission
        email = f"v4_machann_{int(time.time())}@toplotto.ht"
        r = admin_client.post(f"{base_url}/api/users", json={
            "email": email, "password": "Pass123!", "name": "Machann V4",
            "role": "machann", "commission_percent": 5.0,
        })
        assert r.status_code == 200, r.text
        token = _login(base_url, email, "Pass123!")
        s = requests.Session()
        s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})

        # Create a ticket for tomorrow
        lots = admin_client.get(f"{base_url}/api/lotteries").json()
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        r = s.post(f"{base_url}/api/tickets", json={
            "lottery_id": lots[0]["id"], "draw_date": tomorrow, "currency": "BRL",
            "items": [{"game": "bolet", "number": "11", "amount": 20}],
            "customer_name": "TEST_v4_comm",
        })
        assert r.status_code == 200, r.text

        r = s.get(f"{base_url}/api/machann/commission")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "sales" in body
        assert "commission_percent" in body
        assert "commission_amount" in body
        assert body["commission_percent"] == 5.0
        assert body["sales"] >= 20.0
        # commission_amount = sales * 5 / 100
        assert abs(body["commission_amount"] - body["sales"] * 5 / 100) < 0.01


# ---------- 8) GET /api/tickets/{n}/pdf ----------
class TestTicketPDF:
    def test_pdf_endpoint(self, admin_client, base_url):
        # Create ticket
        lots = admin_client.get(f"{base_url}/api/lotteries").json()
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        r = admin_client.post(f"{base_url}/api/tickets", json={
            "lottery_id": lots[0]["id"], "draw_date": tomorrow, "currency": "BRL",
            "items": [{"game": "bolet", "number": "42", "amount": 5}],
            "customer_name": "TEST_v4_pdf",
        })
        assert r.status_code == 200, r.text
        tn = r.json()["ticket_number"]

        # Download PDF
        r = admin_client.get(f"{base_url}/api/tickets/{tn}/pdf")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf"), \
            f"Expected application/pdf, got {r.headers.get('content-type')}"
        assert r.content[:4] == b"%PDF", f"PDF magic bytes missing: {r.content[:10]}"
        assert len(r.content) > 500, f"PDF too small: {len(r.content)} bytes"
