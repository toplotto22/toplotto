"""
TOP LOTTO - Backend API
Auto-detect game by digit count. Bòlèt with mariage. Position-based payouts (premye/dezyèm/twazyèm).
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import logging
import uuid
import io
import csv
import socket
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt as pyjwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'top-lotto-secret-change-me')
JWT_ALGO = 'HS256'
JWT_EXPIRE_HOURS = 12

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TOP LOTTO API")
api = APIRouter(prefix="/api")
auth_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger("toplotto")
logging.basicConfig(level=logging.INFO)


# ---------- Utils ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def gen_id():
    return str(uuid.uuid4())


def hash_password(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw, hashed):
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id, role):
    payload = {
        "sub": user_id, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(creds: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    if not creds:
        raise HTTPException(401, "Missing token")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except pyjwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User not found or inactive")
    return user


def require_roles(*roles):
    async def checker(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Forbidden - requires {roles}")
        return user
    return checker


async def audit(user_id, action, details=None):
    await db.audit_logs.insert_one({
        "id": gen_id(), "user_id": user_id, "action": action,
        "details": details or {}, "timestamp": now_iso(),
    })


# ---------- Models ----------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    agency_id: Optional[str] = None
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    agency_id: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class AgencyCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    phone: Optional[str] = ""
    supervisor_id: Optional[str] = None
    admin_id: Optional[str] = None
    active: bool = True


class TicketItem(BaseModel):
    game: str  # bolet, pick3, pick4, pick5, mariage
    number: str  # for mariage use "AA-BB" format
    amount: float


class TicketCreate(BaseModel):
    lottery_id: str
    draw_date: str
    currency: str
    items: List[TicketItem]
    customer_name: Optional[str] = ""


class ResultCreate(BaseModel):
    lottery_id: str
    draw_date: str
    pick3: Optional[str] = ""
    pick4: Optional[str] = ""
    pick5: Optional[str] = ""
    bolet: Optional[List[str]] = None  # [premye, dezyem, twazyem]


class TicketUpdate(BaseModel):
    items: Optional[List[TicketItem]] = None
    customer_name: Optional[str] = None
    status: Optional[str] = None


class NetworkPrintInput(BaseModel):
    ticket_number: str
    printer_ip: str
    printer_port: int = 9100
    width: int = 80


class SettingsUpdate(BaseModel):
    business_name: Optional[str] = None
    business_phone: Optional[str] = None
    business_address: Optional[str] = None
    business_email: Optional[str] = None
    ticket_footer: Optional[str] = None
    exchange_rate_brl_to_htg: Optional[float] = None
    payouts: Optional[Dict[str, Any]] = None
    limits: Optional[Dict[str, Any]] = None


# ---------- Auth ----------
@api.post("/auth/login")
async def login(data: LoginInput):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    if not user.get("active", True):
        raise HTTPException(403, "Compte désactivé")
    token = create_token(user["id"], user["role"])
    await audit(user["id"], "login")
    return {"token": token, "user": {
        "id": user["id"], "email": user["email"], "name": user["name"],
        "role": user["role"], "agency_id": user.get("agency_id"),
    }}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


# ---------- Users ----------
@api.get("/users")
async def list_users(user=Depends(require_roles("super_admin", "admin", "directeur", "superviseur"))):
    return await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)


@api.post("/users")
async def create_user(data: UserCreate, user=Depends(require_roles("super_admin", "admin"))):
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email déjà utilisé")
    doc = {
        "id": gen_id(), "email": data.email.lower(), "password": hash_password(data.password),
        "name": data.name, "role": data.role, "agency_id": data.agency_id,
        "phone": data.phone, "active": True, "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    await audit(user["id"], "user.create", {"target": doc["id"]})
    doc.pop("_id", None)
    doc.pop("password", None)
    return doc


@api.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, user=Depends(require_roles("super_admin", "admin"))):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "password" in update:
        update["password"] = hash_password(update["password"])
    if not update:
        raise HTTPException(400, "Aucun changement")
    await db.users.update_one({"id": user_id}, {"$set": update})
    await audit(user["id"], "user.update", {"target": user_id})
    return {"ok": True}


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, hard: bool = False, user=Depends(require_roles("super_admin"))):
    if user_id == user["id"]:
        raise HTTPException(400, "Vous ne pouvez pas supprimer votre propre compte")
    if hard:
        await db.users.delete_one({"id": user_id})
        await audit(user["id"], "user.delete", {"target": user_id})
    else:
        await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
        await audit(user["id"], "user.deactivate", {"target": user_id})
    return {"ok": True}


# ---------- Agencies ----------
@api.get("/agencies")
async def list_agencies(user=Depends(current_user)):
    return await db.agencies.find({}, {"_id": 0}).to_list(1000)


@api.post("/agencies")
async def create_agency(data: AgencyCreate, user=Depends(require_roles("super_admin", "admin", "superviseur"))):
    doc = {"id": gen_id(), **data.model_dump(), "balance": 0.0, "created_at": now_iso()}
    await db.agencies.insert_one(doc)
    await audit(user["id"], "agency.create", {"target": doc["id"]})
    doc.pop("_id", None)
    return doc


@api.put("/agencies/{aid}")
async def update_agency(aid: str, data: AgencyCreate, user=Depends(require_roles("super_admin", "admin"))):
    await db.agencies.update_one({"id": aid}, {"$set": data.model_dump()})
    return {"ok": True}


# ---------- Lotteries ----------
@api.get("/lotteries")
async def list_lotteries(user=Depends(current_user)):
    return await db.lotteries.find({}, {"_id": 0}).sort([("state", 1), ("session", 1)]).to_list(100)


# ---------- Payout calculation ----------
def check_win(item, results):
    """
    Returns (won, position, payout_key).
    - bolet: matches one of 3 boul → position 1/2/3 → premye/dezyem/twazyem
    - mariage: 2 numbers must both be in the 3 boul → mariage rate
    - pick3/4/5: exact match against single result
    """
    game = item["game"]
    if game == "bolet":
        boul = results.get("bolet") or []
        for idx, b in enumerate(boul[:3]):
            if b and item["number"] == b:
                key = ["premye", "dezyem", "twazyem"][idx]
                return (True, idx + 1, key)
    elif game == "mariage":
        boul = set(b for b in (results.get("bolet") or []) if b)
        parts = (item.get("number") or "").split("-")
        if len(parts) == 2 and all(p in boul for p in parts):
            return (True, 0, "mariage")
    elif game == "pick3":
        if results.get("pick3") and item["number"] == results["pick3"]:
            return (True, 1, "straight")
    elif game == "pick4":
        if results.get("pick4") and item["number"] == results["pick4"]:
            return (True, 1, "straight")
    elif game == "pick5":
        if results.get("pick5") and item["number"] == results["pick5"]:
            return (True, 1, "straight")
    return (False, 0, "")


def compute_payout(item, results, payouts_cfg):
    won, pos, key = check_win(item, results)
    if not won:
        return 0.0
    game = item["game"]
    cfg = payouts_cfg.get(game, {})
    rate = 0.0
    if game == "bolet":
        rate = float(cfg.get(key, 0) or 0)
    elif game == "mariage":
        rate = float(payouts_cfg.get("bolet", {}).get("mariage", 0) or 0)
    elif game in ("pick3", "pick4", "pick5"):
        rate = float(cfg if isinstance(cfg, (int, float)) else cfg.get("straight", 0) or 0)
    return float(item["amount"]) * rate


# ---------- Tickets ----------
@api.post("/tickets")
async def create_ticket(data: TicketCreate, user=Depends(current_user)):
    lottery = await db.lotteries.find_one({"id": data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(404, "Loterie introuvable")
    items = []
    total = 0.0
    for it in data.items:
        line_total = float(it.amount)
        total += line_total
        items.append({**it.model_dump(), "line_total": line_total})

    seq_doc = await db.counters.find_one_and_update(
        {"id": "ticket_seq"}, {"$inc": {"value": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    seq = (seq_doc or {}).get("value", 1)
    ticket_number = f"TL{datetime.now().strftime('%y%m%d')}{seq:05d}"

    doc = {
        "id": gen_id(), "ticket_number": ticket_number,
        "lottery_id": data.lottery_id, "lottery_name": lottery["name"],
        "draw_date": data.draw_date, "currency": data.currency,
        "items": items, "total": total,
        "customer_name": data.customer_name or "",
        "machann_id": user["id"], "machann_name": user["name"],
        "agency_id": user.get("agency_id"),
        "status": "active", "payout_amount": 0.0, "paid": False,
        "created_at": now_iso(),
    }
    await db.tickets.insert_one(doc)
    await audit(user["id"], "ticket.sell", {"ticket": ticket_number, "total": total})
    doc.pop("_id", None)
    return doc


@api.get("/tickets")
async def list_tickets(
    user=Depends(current_user),
    machann_id: Optional[str] = None,
    agency_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    lottery_id: Optional[str] = None,
    limit: int = 200,
):
    q = {}
    if user["role"] == "machann":
        q["machann_id"] = user["id"]
    elif machann_id:
        q["machann_id"] = machann_id
    if agency_id:
        q["agency_id"] = agency_id
    if lottery_id:
        q["lottery_id"] = lottery_id
    if date_from or date_to:
        q["draw_date"] = {}
        if date_from:
            q["draw_date"]["$gte"] = date_from
        if date_to:
            q["draw_date"]["$lte"] = date_to
    return await db.tickets.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)


async def _enrich_ticket(ticket_number: str):
    t = await db.tickets.find_one({"ticket_number": ticket_number}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    result = await db.results.find_one({"lottery_id": t["lottery_id"], "draw_date": t["draw_date"]}, {"_id": 0})
    settings = await get_settings_doc()
    payouts_cfg = settings.get("payouts", {})
    t["result"] = result
    # Cancelled tickets: keep persisted state, skip recompute
    if t.get("status") == "cancelled":
        t["has_result"] = bool(result)
        return t
    if result:
        total_win = 0.0
        for it in t["items"]:
            won, pos, key = check_win(it, result)
            payout = compute_payout(it, result, payouts_cfg)
            it["winning"] = won
            it["win_position"] = pos
            it["win_key"] = key
            it["payout"] = payout
            total_win += payout
        t["payout_amount"] = total_win
        t["has_result"] = True
    else:
        t["has_result"] = False
    return t


@api.get("/tickets/{ticket_number}")
async def get_ticket(ticket_number: str, user=Depends(current_user)):
    return await _enrich_ticket(ticket_number)


@api.post("/tickets/{ticket_number}/pay")
async def pay_ticket(ticket_number: str, user=Depends(require_roles("super_admin", "admin", "machann"))):
    t = await db.tickets.find_one({"ticket_number": ticket_number}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    if t.get("paid"):
        raise HTTPException(400, "Ticket déjà payé")
    result = await db.results.find_one({"lottery_id": t["lottery_id"], "draw_date": t["draw_date"]}, {"_id": 0})
    if not result:
        raise HTTPException(400, "Résultats non disponibles")
    settings = await get_settings_doc()
    payouts_cfg = settings.get("payouts", {})
    total_win = sum(compute_payout(it, result, payouts_cfg) for it in t["items"])
    if total_win <= 0:
        raise HTTPException(400, "Ticket non gagnant")
    await db.tickets.update_one(
        {"ticket_number": ticket_number},
        {"$set": {"paid": True, "payout_amount": total_win, "paid_at": now_iso(), "paid_by": user["id"]}},
    )
    await db.payouts.insert_one({
        "id": gen_id(), "ticket_number": ticket_number, "amount": total_win,
        "currency": t["currency"], "paid_by": user["id"], "paid_at": now_iso(),
    })
    await audit(user["id"], "ticket.pay", {"ticket": ticket_number, "amount": total_win})
    return {"ok": True, "amount": total_win}


@api.put("/tickets/{ticket_number}")
async def update_ticket(ticket_number: str, data: TicketUpdate, user=Depends(require_roles("super_admin"))):
    t = await db.tickets.find_one({"ticket_number": ticket_number})
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    update = {}
    if data.items is not None:
        items = []
        total = 0.0
        for it in data.items:
            ld = it.model_dump()
            ld["line_total"] = float(it.amount)
            total += float(it.amount)
            items.append(ld)
        update["items"] = items
        update["total"] = total
    if data.customer_name is not None:
        update["customer_name"] = data.customer_name
    if data.status is not None:
        update["status"] = data.status
    if not update:
        raise HTTPException(400, "Aucun changement")
    await db.tickets.update_one({"ticket_number": ticket_number}, {"$set": update})
    await audit(user["id"], "ticket.update", {"ticket": ticket_number, "fields": list(update.keys())})
    return {"ok": True}


@api.delete("/tickets/{ticket_number}")
async def cancel_ticket(ticket_number: str, hard: bool = False, user=Depends(require_roles("super_admin", "admin"))):
    t = await db.tickets.find_one({"ticket_number": ticket_number})
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    # Only super_admin can act on a paid ticket
    if t.get("paid") and user["role"] != "super_admin":
        raise HTTPException(400, "Ticket déjà payé - super admin requis")
    if hard and user["role"] == "super_admin":
        await db.tickets.delete_one({"ticket_number": ticket_number})
        if t.get("paid"):
            await db.payouts.delete_many({"ticket_number": ticket_number})
        await audit(user["id"], "ticket.delete", {"ticket": ticket_number})
    else:
        upd = {"status": "cancelled"}
        if t.get("paid") and user["role"] == "super_admin":
            upd["paid"] = False
            upd["payout_amount"] = 0.0
            await db.payouts.delete_many({"ticket_number": ticket_number})
        await db.tickets.update_one({"ticket_number": ticket_number}, {"$set": upd})
        await audit(user["id"], "ticket.cancel", {"ticket": ticket_number})
    return {"ok": True}


# ---------- Results ----------
@api.get("/results")
async def list_results(
    lottery_id: Optional[str] = None,
    draw_date: Optional[str] = None,
    user=Depends(current_user),
):
    q = {}
    if lottery_id:
        q["lottery_id"] = lottery_id
    if draw_date:
        q["draw_date"] = draw_date
    return await db.results.find(q, {"_id": 0}).sort("draw_date", -1).to_list(500)


@api.post("/results")
async def upsert_result(data: ResultCreate, user=Depends(require_roles("super_admin", "admin", "directeur"))):
    doc = {
        "lottery_id": data.lottery_id, "draw_date": data.draw_date,
        "pick3": data.pick3 or "", "pick4": data.pick4 or "",
        "pick5": data.pick5 or "", "bolet": data.bolet or [],
        "updated_at": now_iso(), "updated_by": user["id"],
    }
    await db.results.update_one(
        {"lottery_id": data.lottery_id, "draw_date": data.draw_date},
        {"$set": doc, "$setOnInsert": {"id": gen_id(), "created_at": now_iso()}},
        upsert=True,
    )
    # Get lottery name for notification
    lottery = await db.lotteries.find_one({"id": data.lottery_id}, {"_id": 0})
    lottery_name = lottery["name"] if lottery else "?"
    # Notify all machanns
    await create_notification(
        target_role="machann",
        type_="result",
        title="Rezilta yo soti / Résultats publiés",
        body=f"{lottery_name} — {data.draw_date}",
        link="/results",
    )
    # Compute winning tickets for this draw and notify admins
    settings = await get_settings_doc()
    payouts_cfg = settings.get("payouts", {})
    winner_count = 0
    total_owed = 0.0
    async for t in db.tickets.find({"lottery_id": data.lottery_id, "draw_date": data.draw_date, "paid": {"$ne": True}}, {"_id": 0}):
        win = sum(compute_payout(it, doc, payouts_cfg) for it in t["items"])
        if win > 0:
            winner_count += 1
            total_owed += win
    if winner_count > 0:
        await create_notification(
            target_role="admin",
            type_="winning",
            title="Tikè genyen pou peyman / Tickets gagnants",
            body=f"{winner_count} tikè • {lottery_name} {data.draw_date} • {total_owed:.2f}",
            link="/payments",
        )
        # also notify super_admin
        await create_notification(
            target_role="super_admin",
            type_="winning",
            title="Tikè genyen pou peyman / Tickets gagnants",
            body=f"{winner_count} tikè • {lottery_name} {data.draw_date} • {total_owed:.2f}",
            link="/payments",
        )
    await audit(user["id"], "result.upsert", {"lottery": data.lottery_id, "date": data.draw_date})
    return doc


# ---------- Notifications ----------
async def create_notification(type_, title, body, target_role=None, target_user_id=None, link=""):
    await db.notifications.insert_one({
        "id": gen_id(),
        "type": type_,
        "title": title,
        "body": body,
        "link": link,
        "target_role": target_role,
        "target_user_id": target_user_id,
        "read_by": [],
        "created_at": now_iso(),
    })


@api.get("/notifications")
async def list_notifications(user=Depends(current_user), limit: int = 50):
    q = {
        "$or": [
            {"target_user_id": user["id"]},
            {"target_role": user["role"]},
            {"target_role": "all"},
        ]
    }
    notifs = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # mark read status
    for n in notifs:
        n["read"] = user["id"] in (n.get("read_by") or [])
    return notifs


@api.get("/notifications/count")
async def notif_count(user=Depends(current_user)):
    q = {
        "$or": [
            {"target_user_id": user["id"]},
            {"target_role": user["role"]},
            {"target_role": "all"},
        ],
        "read_by": {"$ne": user["id"]},
    }
    return {"unread": await db.notifications.count_documents(q)}


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(current_user)):
    await db.notifications.update_one({"id": nid}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(current_user)):
    q = {
        "$or": [
            {"target_user_id": user["id"]},
            {"target_role": user["role"]},
            {"target_role": "all"},
        ],
    }
    await db.notifications.update_many(q, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}


# ---------- ESC/POS ----------
GAME_LABELS_ESCPOS = {
    "bolet": "BOLET",
    "mariage": "MARYAJ",
    "pick3": "PICK 3",
    "pick4": "PICK 4",
    "pick5": "PICK 5",
}


def escpos_ticket_bytes(ticket: dict, settings: dict, width: int = 80) -> bytes:
    """Generate ESC/POS commands for a thermal printer (58mm = 32 chars, 80mm = 48 chars)."""
    line_width = 32 if width == 58 else 48
    ESC = b'\x1B'
    GS = b'\x1D'
    out = bytearray()
    out += ESC + b'@'  # init

    def line(text: str = "", align: int = 0, style: int = 0):
        nonlocal out
        out += ESC + b'a' + bytes([align])
        out += ESC + b'!' + bytes([style])
        try:
            out += text.encode('cp850', errors='replace')
        except Exception:
            out += text.encode('ascii', errors='replace')
        out += b'\n'

    def sep(c="-"):
        nonlocal out
        out += ESC + b'a' + b'\x00'
        out += ESC + b'!' + b'\x00'
        out += (c * line_width).encode() + b'\n'

    # Header
    line(settings.get("business_name", "TOP LOTTO"), align=1, style=0x30)  # double + emphasize
    line(settings.get("business_address", ""), align=1)
    line(settings.get("business_phone", ""), align=1)
    sep("=")
    # Ticket info
    line(f"TIKE: {ticket['ticket_number']}", style=0x08)
    line(f"DAT : {ticket.get('created_at', '')[:19].replace('T', ' ')}")
    line(f"LOTRI: {ticket.get('lottery_name', '')}")
    line(f"TIRAJ: {ticket.get('draw_date', '')}")
    line(f"MACHANN: {ticket.get('machann_name', '')}")
    if ticket.get("customer_name"):
        line(f"KLIYAN: {ticket['customer_name']}")
    sep()
    # Items
    line("JWET".center(line_width), style=0x08)
    for it in ticket["items"]:
        g = GAME_LABELS_ESCPOS.get(it["game"], it["game"].upper())
        win_tag = ""
        if it.get("winning"):
            if it["game"] == "bolet":
                win_tag = ["", "*1ye", "*2yem", "*3yem"][it.get("win_position", 0)]
            else:
                win_tag = "*GENYEN"
        left = f"{g} {it['number']} {win_tag}".strip()
        right = f"{float(it.get('line_total', it['amount'])):.2f}"
        space = max(1, line_width - len(left) - len(right))
        line(left + (" " * space) + right)
    sep()
    # Total
    total = float(ticket.get("total", 0))
    left = "TOTAL"
    right = f"{total:.2f} {ticket.get('currency', 'BRL')}"
    space = max(1, line_width - len(left) - len(right))
    line(left + (" " * space) + right, style=0x18)  # double width+height
    # Result block
    if ticket.get("has_result") and ticket.get("result"):
        r = ticket["result"]
        sep()
        line("REZILTA".center(line_width), style=0x08)
        if r.get("bolet"):
            boul_str = " ".join(f"{['1ye','2yem','3yem'][i]}={b}" for i, b in enumerate(r["bolet"]) if b)
            line(f"BOLET: {boul_str}")
        if r.get("pick3"):
            line(f"P3: {r['pick3']}")
        if r.get("pick4"):
            line(f"P4: {r['pick4']}")
        if r.get("pick5"):
            line(f"P5: {r['pick5']}")
    # Payout
    if ticket.get("payout_amount", 0) > 0:
        sep("=")
        line("*** GENYEN ***".center(line_width), align=1, style=0x30)
        line(f"{ticket['payout_amount']:.2f} {ticket.get('currency', 'BRL')}".center(line_width), align=1, style=0x18)
        if ticket.get("paid"):
            line("[ PEYE ]".center(line_width), align=1, style=0x08)
    sep("=")
    # Barcode (CODE39)
    out += ESC + b'a' + b'\x01'  # center
    out += GS + b'h' + b'\x50'   # height 80
    out += GS + b'w' + b'\x02'   # width 2
    out += GS + b'H' + b'\x02'   # HRI below
    out += GS + b'k' + b'\x04'   # CODE39
    out += ticket["ticket_number"].encode() + b'\x00'
    out += b'\n'
    # Footer
    if settings.get("ticket_footer"):
        line(settings["ticket_footer"], align=1)
    out += b'\n\n\n'
    # Cut
    out += GS + b'V' + b'\x42' + b'\x00'  # partial cut
    return bytes(out)


@api.get("/tickets/{ticket_number}/escpos")
async def ticket_escpos(ticket_number: str, width: int = 80, user=Depends(current_user)):
    t = await _enrich_ticket(ticket_number)
    settings = await get_settings_doc()
    data = escpos_ticket_bytes(t, settings, width)
    return Response(content=data, media_type="application/octet-stream",
                    headers={"Content-Disposition": f"attachment; filename={ticket_number}.bin"})


@api.post("/print/network")
async def print_network(data: NetworkPrintInput, user=Depends(current_user)):
    t = await _enrich_ticket(data.ticket_number)
    settings = await get_settings_doc()
    payload = escpos_ticket_bytes(t, settings, data.width)
    try:
        with socket.create_connection((data.printer_ip, data.printer_port), timeout=8) as sock:
            sock.sendall(payload)
        await audit(user["id"], "print.network", {"ticket": data.ticket_number, "ip": data.printer_ip})
        return {"ok": True, "bytes": len(payload)}
    except Exception as e:
        raise HTTPException(500, f"Impression échec: {e}")


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    q = {"created_at": {"$gte": today}}
    if user["role"] == "machann":
        q["machann_id"] = user["id"]
    elif user["role"] in ("admin", "sous_admin") and user.get("agency_id"):
        q["agency_id"] = user["agency_id"]

    sales_total = 0.0
    tickets_sold = 0
    tickets_winning = 0
    payments_total = 0.0
    by_lottery = {}

    async for t in db.tickets.find(q, {"_id": 0}):
        sales_total += float(t.get("total", 0))
        tickets_sold += 1
        if t.get("paid"):
            payments_total += float(t.get("payout_amount", 0))
        if t.get("payout_amount", 0) > 0:
            tickets_winning += 1
        ln = t.get("lottery_name", "?")
        by_lottery[ln] = by_lottery.get(ln, 0) + float(t.get("total", 0))

    trend = []
    for i in range(6, -1, -1):
        day_dt = datetime.now(timezone.utc) - timedelta(days=i)
        day = day_dt.strftime("%Y-%m-%d")
        next_day = (day_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        q2 = {**{k: v for k, v in q.items() if k != "created_at"},
              "created_at": {"$gte": day, "$lt": next_day}}
        total_day = 0.0
        async for t in db.tickets.find(q2, {"_id": 0}):
            total_day += float(t.get("total", 0))
        trend.append({"day": day[5:], "sales": round(total_day, 2)})

    recent_tickets = await db.tickets.find(q, {"_id": 0}).sort("created_at", -1).to_list(5)
    recent_results = await db.results.find({}, {"_id": 0}).sort("draw_date", -1).to_list(5)

    return {
        "sales_total": round(sales_total, 2),
        "payments_total": round(payments_total, 2),
        "profit": round(sales_total - payments_total, 2),
        "tickets_sold": tickets_sold,
        "tickets_winning": tickets_winning,
        "balance": round(sales_total - payments_total, 2),
        "by_lottery": [{"name": k, "value": round(v, 2)} for k, v in by_lottery.items()],
        "trend": trend,
        "recent_tickets": recent_tickets,
        "recent_results": recent_results,
    }


# ---------- Settings ----------
DEFAULT_PAYOUTS = {
    "bolet": {"premye": 50, "dezyem": 20, "twazyem": 10, "mariage": 500},
    "pick3": 500,
    "pick4": 5000,
    "pick5": 50000,
}
DEFAULT_LIMITS = {"per_number": 1000, "per_game": 5000, "per_lottery": 10000, "per_machann": 50000}


async def get_settings_doc():
    doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        doc = {
            "id": "global",
            "business_name": "TOP LOTTO",
            "business_phone": "+509 0000 0000",
            "business_address": "Port-au-Prince, Haïti",
            "business_email": "info@toplotto.ht",
            "ticket_footer": "Mèsi pou konfyans ou! Bòn chans!",
            "exchange_rate_brl_to_htg": 25.0,
            "payouts": DEFAULT_PAYOUTS,
            "limits": DEFAULT_LIMITS,
        }
        await db.settings.insert_one(doc)
    return doc


@api.get("/settings")
async def get_settings(user=Depends(current_user)):
    s = await get_settings_doc()
    # ensure modern payout structure
    if not isinstance(s.get("payouts", {}).get("bolet"), dict) or "premye" not in s.get("payouts", {}).get("bolet", {}):
        s["payouts"] = DEFAULT_PAYOUTS
        await db.settings.update_one({"id": "global"}, {"$set": {"payouts": DEFAULT_PAYOUTS}})
    return s


@api.put("/settings")
async def update_settings(data: SettingsUpdate, user=Depends(require_roles("super_admin"))):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    await audit(user["id"], "settings.update", update)
    return await get_settings_doc()


# ---------- Reports ----------
@api.get("/reports/sales")
async def report_sales(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    group_by: str = "day",
    user=Depends(require_roles("super_admin", "directeur", "superviseur", "admin")),
):
    q = {}
    if user["role"] in ("admin", "sous_admin") and user.get("agency_id"):
        q["agency_id"] = user["agency_id"]
    if date_from or date_to:
        q["draw_date"] = {}
        if date_from:
            q["draw_date"]["$gte"] = date_from
        if date_to:
            q["draw_date"]["$lte"] = date_to

    rows = {}
    async for t in db.tickets.find(q, {"_id": 0}):
        if group_by == "day":
            key = t.get("draw_date", "?")
        elif group_by == "lottery":
            key = t.get("lottery_name", "?")
        elif group_by == "machann":
            key = t.get("machann_name", "?")
        else:
            key = t.get("agency_id", "?") or "Sans agence"
        if key not in rows:
            rows[key] = {"sales": 0, "payouts": 0, "tickets": 0, "winners": 0}
        rows[key]["sales"] += float(t.get("total", 0))
        rows[key]["payouts"] += float(t.get("payout_amount", 0)) if t.get("paid") else 0
        rows[key]["tickets"] += 1
        if t.get("payout_amount", 0) > 0:
            rows[key]["winners"] += 1
    return [{"key": k, **v, "profit": round(v["sales"] - v["payouts"], 2)} for k, v in rows.items()]


@api.get("/reports/export")
async def report_export(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_roles("super_admin", "directeur", "admin")),
):
    q = {}
    if date_from or date_to:
        q["draw_date"] = {}
        if date_from:
            q["draw_date"]["$gte"] = date_from
        if date_to:
            q["draw_date"]["$lte"] = date_to
    tickets = await db.tickets.find(q, {"_id": 0}).to_list(10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Ticket", "Date", "Loterie", "Machann", "Devise", "Total", "Paye", "Gain"])
    for t in tickets:
        writer.writerow([
            t["ticket_number"], t["draw_date"], t["lottery_name"], t["machann_name"],
            t["currency"], t["total"], "Oui" if t.get("paid") else "Non", t.get("payout_amount", 0),
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=rapport-{now_iso()[:10]}.csv"},
    )


@api.get("/audit")
async def list_audit(user=Depends(require_roles("super_admin", "directeur"))):
    return await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(200)


@api.get("/payments")
async def list_payments(user=Depends(current_user)):
    return await db.payouts.find({}, {"_id": 0}).sort("paid_at", -1).to_list(200)


# ---------- Seed ----------
DEFAULT_LOTTERIES = [
    {"name": "Florida Midi", "code": "FL_MID", "state": "FL", "session": "midday"},
    {"name": "Florida Soir", "code": "FL_EVE", "state": "FL", "session": "evening"},
    {"name": "Georgia Midi", "code": "GA_MID", "state": "GA", "session": "midday"},
    {"name": "Georgia Soir", "code": "GA_EVE", "state": "GA", "session": "evening"},
    {"name": "New York Midi", "code": "NY_MID", "state": "NY", "session": "midday"},
    {"name": "New York Soir", "code": "NY_EVE", "state": "NY", "session": "evening"},
    {"name": "Texas Midi", "code": "TX_MID", "state": "TX", "session": "midday"},
    {"name": "Texas Soir", "code": "TX_EVE", "state": "TX", "session": "evening"},
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.tickets.create_index("ticket_number", unique=True)
    await db.results.create_index([("lottery_id", 1), ("draw_date", 1)], unique=True)

    # Migration: rebuild lotteries if structure outdated (no 'state' field)
    sample = await db.lotteries.find_one({})
    if sample and "state" not in sample:
        logger.info("Migrating lotteries to new structure (state/session)...")
        await db.lotteries.delete_many({})
        sample = None

    if not sample:
        for lot in DEFAULT_LOTTERIES:
            await db.lotteries.update_one(
                {"code": lot["code"]},
                {"$set": {**lot, "active": True}, "$setOnInsert": {"id": gen_id()}},
                upsert=True,
            )

    # Seed super admin
    if not await db.users.find_one({"role": "super_admin"}):
        await db.users.insert_one({
            "id": gen_id(), "email": "admin@toplotto.ht",
            "password": hash_password("Admin123!"),
            "name": "Super Admin", "role": "super_admin",
            "active": True, "created_at": now_iso(),
        })
        logger.info("Seeded super admin")

    if not await db.agencies.find_one({}):
        await db.agencies.insert_one({
            "id": gen_id(), "name": "Agence Principale",
            "address": "Port-au-Prince", "phone": "+509 0000 0000",
            "active": True, "balance": 0.0, "created_at": now_iso(),
        })

    await get_settings_doc()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
