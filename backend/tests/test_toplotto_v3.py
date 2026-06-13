"""TOP LOTTO V3 backend API tests - notifications, ESC/POS, super_admin extended powers."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


# -------- Notifications --------
class TestNotifications:
    def test_notif_count_endpoint(self, admin_client):
        r = admin_client.get(f"{API}/notifications/count")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "unread" in d
        assert isinstance(d["unread"], int)

    def test_notif_list_endpoint(self, admin_client):
        r = admin_client.get(f"{API}/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_result_triggers_notifications(self, admin_client):
        # Create machann user to receive notification
        machann_email = f"v3_test_{uuid.uuid4().hex[:6]}@toplotto.ht"
        r = admin_client.post(f"{API}/users", json={
            "email": machann_email, "password": "Pass123!",
            "name": "V3 Test Machann", "role": "machann"
        })
        assert r.status_code == 200
        # Login as machann
        ml = requests.post(f"{API}/auth/login", json={"email": machann_email, "password": "Pass123!"})
        assert ml.status_code == 200
        machann_token = ml.json()["token"]
        machann_session = requests.Session()
        machann_session.headers.update({"Authorization": f"Bearer {machann_token}"})

        # Baseline count
        before = machann_session.get(f"{API}/notifications/count").json()["unread"]

        # Create a winning ticket (machann buys) then publish result
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        date = f"2099-05-{uuid.uuid4().hex[:2]}"
        # Sell as machann
        tr = machann_session.post(f"{API}/tickets", json={
            "lottery_id": lot["id"], "draw_date": date, "currency": "BRL",
            "items": [{"game": "bolet", "number": "44", "amount": 10}],
            "customer_name": "V3"
        })
        assert tr.status_code == 200, tr.text

        # Admin publishes result (winning for the machann ticket)
        rres = admin_client.post(f"{API}/results", json={
            "lottery_id": lot["id"], "draw_date": date, "bolet": ["44", "00", "11"]
        })
        assert rres.status_code == 200

        # Machann should now have +1 'result' notif
        after_m = machann_session.get(f"{API}/notifications/count").json()["unread"]
        assert after_m > before, f"Machann unread should increase. before={before} after={after_m}"
        notifs = machann_session.get(f"{API}/notifications").json()
        assert any("Rezilta" in n.get("title", "") for n in notifs), f"No 'Rezilta' notif found: {[n.get('title') for n in notifs[:5]]}"

        # Admin/super_admin should have a 'winning' notif
        admin_notifs = admin_client.get(f"{API}/notifications").json()
        assert any("genyen" in n.get("title", "").lower() or "Tikè" in n.get("title", "") for n in admin_notifs), \
            f"No winning-ticket notif for admin: {[n.get('title') for n in admin_notifs[:5]]}"

    def test_mark_read(self, admin_client):
        notifs = admin_client.get(f"{API}/notifications").json()
        if not notifs:
            pytest.skip("No notifications to mark read")
        nid = notifs[0]["id"]
        r = admin_client.post(f"{API}/notifications/{nid}/read")
        assert r.status_code == 200

    def test_mark_all_read(self, admin_client):
        r = admin_client.post(f"{API}/notifications/read-all")
        assert r.status_code == 200
        after = admin_client.get(f"{API}/notifications/count").json()["unread"]
        assert after == 0, f"Expected unread=0 after read-all, got {after}"


# -------- ESC/POS --------
class TestEscPos:
    def _make_ticket(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        r = admin_client.post(f"{API}/tickets", json={
            "lottery_id": lot["id"], "draw_date": "2099-06-01", "currency": "BRL",
            "items": [{"game": "bolet", "number": "11", "amount": 5}], "customer_name": "V3"
        })
        assert r.status_code == 200, r.text
        return r.json()["ticket_number"]

    def test_escpos_80mm(self, admin_client):
        tn = self._make_ticket(admin_client)
        r = admin_client.get(f"{API}/tickets/{tn}/escpos", params={"width": 80})
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/octet-stream")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert len(r.content) > 100, "ESC/POS bytes too short"
        # Should contain ESC @ init bytes
        assert r.content.startswith(b'\x1B@')

    def test_escpos_58mm(self, admin_client):
        tn = self._make_ticket(admin_client)
        r = admin_client.get(f"{API}/tickets/{tn}/escpos", params={"width": 58})
        assert r.status_code == 200
        assert len(r.content) > 100


# -------- Network print --------
class TestNetworkPrint:
    def test_network_print_unreachable_returns_500(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        tr = admin_client.post(f"{API}/tickets", json={
            "lottery_id": lot["id"], "draw_date": "2099-06-02", "currency": "BRL",
            "items": [{"game": "bolet", "number": "22", "amount": 5}]
        })
        tn = tr.json()["ticket_number"]
        # Port 65535 should refuse / no listener
        r = admin_client.post(f"{API}/print/network", json={
            "ticket_number": tn, "printer_ip": "127.0.0.1", "printer_port": 65535, "width": 80
        })
        assert r.status_code == 500, f"Expected 500, got {r.status_code} {r.text}"
        body = r.json()
        msg = body.get("detail", "") if isinstance(body, dict) else str(body)
        assert "Impression" in msg or "chec" in msg, f"Expected 'Impression échec', got: {msg}"


# -------- Super_admin extended: PUT ticket / DELETE ticket variants --------
class TestSuperAdminTicketPowers:
    def _make_ticket(self, admin_client, draw_date=None, items=None):
        lot = admin_client.get(f"{API}/lotteries").json()[0]
        items = items or [{"game": "bolet", "number": "11", "amount": 5}]
        r = admin_client.post(f"{API}/tickets", json={
            "lottery_id": lot["id"], "draw_date": draw_date or "2099-07-01",
            "currency": "BRL", "items": items, "customer_name": "Orig"
        })
        assert r.status_code == 200, r.text
        return r.json()

    def test_super_admin_edit_ticket(self, admin_client):
        t = self._make_ticket(admin_client)
        tn = t["ticket_number"]
        # Edit: change items + customer_name
        new_items = [
            {"game": "bolet", "number": "22", "amount": 10},
            {"game": "bolet", "number": "33", "amount": 15},
        ]
        r = admin_client.put(f"{API}/tickets/{tn}", json={
            "items": new_items, "customer_name": "Updated"
        })
        assert r.status_code == 200, f"PUT /tickets/{tn} -> {r.status_code} {r.text}"
        # GET to verify persistence
        got = admin_client.get(f"{API}/tickets/{tn}").json()
        assert got["customer_name"] == "Updated"
        assert len(got["items"]) == 2
        # total should recalculate to 25
        assert got["total"] == 25, f"Expected total=25, got {got['total']}"

    def test_super_admin_cancel_paid_ticket(self, admin_client):
        lot = admin_client.get(f"{API}/lotteries").json()[1]
        date = "2099-07-02"
        # Create winning ticket
        tr = admin_client.post(f"{API}/tickets", json={
            "lottery_id": lot["id"], "draw_date": date, "currency": "BRL",
            "items": [{"game": "bolet", "number": "88", "amount": 10}]
        })
        tn = tr.json()["ticket_number"]
        # Publish result
        admin_client.post(f"{API}/results", json={
            "lottery_id": lot["id"], "draw_date": date, "bolet": ["88", "00", "11"]
        })
        # Pay
        pr = admin_client.post(f"{API}/tickets/{tn}/pay")
        assert pr.status_code == 200, pr.text
        # super_admin cancel (no hard) should reverse payment
        cr = admin_client.delete(f"{API}/tickets/{tn}")
        assert cr.status_code == 200, f"super_admin cancel paid ticket -> {cr.status_code} {cr.text}"
        got = admin_client.get(f"{API}/tickets/{tn}").json()
        assert got["status"] == "cancelled"
        assert got["paid"] is False
        assert got["payout_amount"] == 0

    def test_super_admin_hard_delete_ticket(self, admin_client):
        t = self._make_ticket(admin_client, draw_date="2099-07-03")
        tn = t["ticket_number"]
        r = admin_client.delete(f"{API}/tickets/{tn}", params={"hard": "true"})
        assert r.status_code == 200, r.text
        # Should be gone
        g = admin_client.get(f"{API}/tickets/{tn}")
        assert g.status_code == 404, f"Hard-deleted ticket should 404, got {g.status_code}"


# -------- Super_admin hard delete user --------
class TestSuperAdminUser:
    def test_hard_delete_user(self, admin_client):
        email = f"hd_{uuid.uuid4().hex[:6]}@toplotto.ht"
        cr = admin_client.post(f"{API}/users", json={
            "email": email, "password": "Pass123!", "name": "HD test", "role": "machann"
        })
        assert cr.status_code == 200
        uid = cr.json()["id"]
        dr = admin_client.delete(f"{API}/users/{uid}", params={"hard": "true"})
        assert dr.status_code == 200
        # Try login - should fail (user gone)
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "Pass123!"})
        assert lr.status_code == 401

    def test_soft_delete_user(self, admin_client):
        email = f"sd_{uuid.uuid4().hex[:6]}@toplotto.ht"
        cr = admin_client.post(f"{API}/users", json={
            "email": email, "password": "Pass123!", "name": "SD test", "role": "machann"
        })
        uid = cr.json()["id"]
        dr = admin_client.delete(f"{API}/users/{uid}")
        assert dr.status_code == 200
        # Should be inactive - login refused
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "Pass123!"})
        assert lr.status_code == 403

    def test_cannot_delete_own_account(self, admin_client):
        me = admin_client.get(f"{API}/auth/me").json()
        r = admin_client.delete(f"{API}/users/{me['id']}")
        assert r.status_code == 400


# -------- PWA assets --------
class TestPWAAssets:
    def test_manifest_accessible(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/manifest.json")
        assert r.status_code == 200, f"manifest.json -> {r.status_code}"

    def test_icon_accessible(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/icon.svg")
        assert r.status_code == 200, f"icon.svg -> {r.status_code}"
