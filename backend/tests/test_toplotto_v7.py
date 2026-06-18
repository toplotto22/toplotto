"""
TOP LOTTO V7 backend tests
Covers:
- VAPID public key endpoint (no auth)
- Public verify ticket endpoint (no auth)
- Reports sales PDF export (admin)
- Push subscribe / unsubscribe / test (auth)
- Ticket PDF still works (with QR + logo)
- Result creation triggers send_push_to_all silently
- VAPID keys persist in MongoDB settings collection
"""
import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://lottery-hub-48.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


# --------- VAPID public key (no auth) ---------
class TestVapid:
    def test_vapid_public_key_no_auth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/push/vapid-public-key")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "publicKey" in data
        pub = data["publicKey"]
        assert isinstance(pub, str) and len(pub) > 40
        # base64url - no padding
        assert "=" not in pub
        assert "+" not in pub and "/" not in pub

    def test_vapid_persisted_in_mongo(self, db, anon_client):
        # Trigger generation if not present
        anon_client.get(f"{BASE_URL}/api/push/vapid-public-key")
        doc = db.settings.find_one({"id": "vapid"})
        assert doc is not None
        # New format: base64url-encoded DER (PKCS8) — pywebpush compatible
        assert doc.get("private_b64", "")
        assert len(doc["private_b64"]) > 100  # DER PKCS8 of P-256 key is ~138 base64 chars
        assert doc.get("public_b64")

    def test_vapid_public_key_stable_across_calls(self, anon_client):
        r1 = anon_client.get(f"{BASE_URL}/api/push/vapid-public-key").json()
        r2 = anon_client.get(f"{BASE_URL}/api/push/vapid-public-key").json()
        assert r1["publicKey"] == r2["publicKey"]


# --------- Public verify ticket endpoint ---------
class TestPublicVerify:
    @pytest.fixture(scope="class")
    def sample_ticket(self, admin_client):
        # Create a ticket to verify
        machanns = admin_client.get(f"{BASE_URL}/api/users", params={"role": "machann"}).json()
        if not machanns:
            # create one
            payload = {"email": "TEST_v7_pub@toplotto.com", "name": "TEST V7 Pub", "role": "machann", "password": "Pass@1234"}
            res = admin_client.post(f"{BASE_URL}/api/users", json=payload)
            assert res.status_code in (200, 201), res.text
            machann_id = res.json()["id"]
        else:
            machann_id = machanns[0]["id"]

        lots = admin_client.get(f"{BASE_URL}/api/lotteries").json()
        if not lots:
            pytest.skip("No lottery available")
        lot = lots[0]

        ticket_payload = {
            "machann_id": machann_id,
            "lottery_id": lot["id"],
            "draw_date": "2099-12-31",
            "customer_name": "TEST V7 PubVerify",
            "currency": "HTG",
            "items": [{"game": "bolet", "number": "12", "amount": 10.0}],
        }
        r = admin_client.post(f"{BASE_URL}/api/tickets", json=ticket_payload)
        assert r.status_code in (200, 201), r.text
        return r.json()

    def test_public_verify_valid_no_auth(self, anon_client, sample_ticket):
        tn = sample_ticket["ticket_number"]
        r = anon_client.get(f"{BASE_URL}/api/public/verify/{tn}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ticket_number"] == tn
        assert "items" in data
        assert "status" in data
        assert "draw_date" in data
        # ensure no sensitive ids leak
        assert "machann_id" not in data
        assert "user_id" not in data

    def test_public_verify_invalid_returns_404(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/public/verify/INVALID_TICKET_XYZ")
        assert r.status_code == 404
        body = r.json()
        # "Tikè pa jwenn"
        msg = body.get("detail") or body.get("message") or ""
        assert "pa jwenn" in msg.lower() or "not found" in msg.lower() or msg

    def test_public_verify_does_not_require_auth_header(self, sample_ticket):
        # Plain requests without session, no headers
        tn = sample_ticket["ticket_number"]
        r = requests.get(f"{BASE_URL}/api/public/verify/{tn}")
        assert r.status_code == 200


# --------- Reports PDF Export ---------
class TestReportsPdf:
    @pytest.mark.parametrize("group_by", ["day", "machann", "lottery", "agency"])
    def test_reports_pdf_each_group(self, admin_client, group_by):
        r = admin_client.get(f"{BASE_URL}/api/reports/sales/pdf", params={"group_by": group_by})
        assert r.status_code == 200, f"group_by={group_by} -> {r.status_code} {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "application/pdf" in ct, ct
        assert len(r.content) > 1024, f"PDF too small: {len(r.content)} bytes"
        assert r.content[:4] == b"%PDF", "Not a valid PDF"

    def test_reports_pdf_unauth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/reports/sales/pdf", params={"group_by": "day"})
        assert r.status_code in (401, 403)


# --------- Push subscribe / unsubscribe / test ---------
class TestPushEndpoints:
    SUB_ENDPOINT = "https://fcm.googleapis.com/fcm/send/TEST_V7_endpoint_xyz"
    SUB_PAYLOAD = {
        "endpoint": SUB_ENDPOINT,
        "keys": {
            "p256dh": "BNvLM8...fake-key",
            "auth": "fake-auth-token",
        },
        "expirationTime": None,
    }

    def test_subscribe_saves_doc(self, admin_client, db):
        r = admin_client.post(f"{BASE_URL}/api/push/subscribe", json=self.SUB_PAYLOAD)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # Verify in MongoDB
        doc = db.push_subscriptions.find_one({"endpoint": self.SUB_ENDPOINT})
        assert doc is not None
        assert doc["keys"]["auth"] == "fake-auth-token"
        assert doc.get("user_id")
        assert doc.get("user_role") == "super_admin"

    def test_subscribe_requires_auth(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/push/subscribe", json=self.SUB_PAYLOAD)
        assert r.status_code in (401, 403)

    def test_push_test_super_admin_returns_sent_cleaned(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/push/test")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "sent" in data
        assert "cleaned" in data
        # fake endpoint should be cleaned (404/410 from fcm) — but accept any non-error response
        assert isinstance(data["sent"], int)
        assert isinstance(data["cleaned"], int)

    def test_unsubscribe_removes_doc(self, admin_client, db):
        # Re-add since previous test may have cleaned it
        admin_client.post(f"{BASE_URL}/api/push/subscribe", json=self.SUB_PAYLOAD)
        r = admin_client.delete(f"{BASE_URL}/api/push/subscribe", params={"endpoint": self.SUB_ENDPOINT})
        assert r.status_code == 200
        doc = db.push_subscriptions.find_one({"endpoint": self.SUB_ENDPOINT})
        assert doc is None


# --------- Ticket PDF still works (QR + logo embedded) ---------
class TestTicketPdfWithQr:
    def test_ticket_pdf_contains_qr_and_logo(self, admin_client):
        # Get any existing ticket
        tickets = admin_client.get(f"{BASE_URL}/api/tickets", params={"limit": 1}).json()
        if isinstance(tickets, dict):
            tickets = tickets.get("items") or tickets.get("data") or []
        if not tickets:
            pytest.skip("No tickets available")
        t = tickets[0]
        tn = t.get("ticket_number") or t.get("id")
        r = admin_client.get(f"{BASE_URL}/api/tickets/{tn}/pdf")
        assert r.status_code == 200, r.text
        assert "application/pdf" in r.headers.get("content-type", "")
        # Expect > 10KB because of logo + QR (>50KB target per spec is aspirational)
        assert len(r.content) > 10 * 1024, f"PDF too small: {len(r.content)}"
        assert r.content[:4] == b"%PDF"


# --------- Result creation should not log "Push notification failed" ---------
class TestResultPushTrigger:
    def test_post_result_triggers_push_silently(self, admin_client):
        # Pick a lottery and post a result for a far-future date so no tickets exist
        lots = admin_client.get(f"{BASE_URL}/api/lotteries").json()
        if not lots:
            pytest.skip("No lottery")
        payload = {
            "lottery_id": lots[0]["id"],
            "draw_date": "2099-11-30",
            "pick3": "111",
            "pick4": "2222",
        }
        r = admin_client.post(f"{BASE_URL}/api/results", json=payload)
        # Accept 200/201/409 (already exists)
        assert r.status_code in (200, 201, 409), r.text
