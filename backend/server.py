"""
TOP LOTTO - Backend API
Single-file FastAPI application managing lottery operations.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import io
import csv
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt as pyjwt
import bcrypt
from itertools import permutations

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
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(creds: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> Dict[str, Any]:
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


async def audit(user_id: str, action: str, details: Dict = None):
    await db.audit_logs.insert_one({
        "id": gen_id(), "user_id": user_id, "action": action,
        "details": details or {}, "timestamp": now_iso()
    })


# ---------- Models ----------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # super_admin, directeur, superviseur, admin, sous_admin, machann
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
    game: str  # bolet, pick3, pick4, pick5
    play_type: str  # straight, box, straight_box, combo
    number: str
    amount: float


class TicketCreate(BaseModel):
    lottery_id: str
    draw_date: str  # YYYY-MM-DD
    currency: str  # HTG | BRL
    items: List[TicketItem]
    customer_name: Optional[str] = ""


class ResultCreate(BaseModel):
    lottery_id: str
    draw_date: str
    pick3: Optional[List[str]] = None  # [r1, r2, r3]
    pick4: Optional[List[str]] = None
    pick5: Optional[List[str]] = None
    bolet: Optional[List[str]] = None  # 3 winning 2-digit numbers


class SettingsUpdate(BaseModel):
    business_name: Optional[str] = None
    business_phone: Optional[str] = None
    business_address: Optional[str] = None
    business_email: Optional[str] = None
    ticket_footer: Optional[str] = None
    exchange_rate_brl_to_htg: Optional[float] = None
    payouts: Optional[Dict[str, Any]] = None
    limits: Optional[Dict[str, Any]] = None


# ---------- Routes: Auth ----------
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


# ---------- Routes: Users (admin) ----------
@api.get("/users")
async def list_users(user=Depends(require_roles("super_admin", "admin", "directeur", "superviseur"))):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users


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
    await audit(user["id"], "user.create", {"target": doc["id"], "role": data.role})
    doc.pop("_id", None); doc.pop("password", None)
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
async def delete_user(user_id: str, user=Depends(require_roles("super_admin"))):
    await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
    await audit(user["id"], "user.deactivate", {"target": user_id})
    return {"ok": True}


# ---------- Routes: Agencies ----------
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


# ---------- Routes: Lotteries & Draws ----------
@api.get("/lotteries")
async def list_lotteries(user=Depends(current_user)):
    return await db.lotteries.find({}, {"_id": 0}).to_list(100)


# ---------- Routes: Tickets ----------
def calc_item_total(item: TicketItem) -> float:
    """Combo multiplies amount by permutations."""
    if item.play_type == "combo":
        digits = list(item.number)
        return item.amount * len(set([''.join(p) for p in permutations(digits)]))
    return item.amount


def check_win(item: dict, results: dict) -> tuple:
    """Returns (won: bool, multiplier_position: int, payout_mode: str)"""
    game = item["game"]
    # determine result list
    key_map = {"bolet": "bolet", "pick3": "pick3", "pick4": "pick4", "pick5": "pick5"}
    res_list = results.get(key_map.get(game)) or []
    if not res_list:
        return (False, 0, "")
    num = item["number"]
    play = item["play_type"]
    for idx, winning in enumerate(res_list[:3]):
        if not winning:
            continue
        if play == "straight":
            if num == winning:
                return (True, idx + 1, "straight")
        elif play == "box":
            if sorted(num) == sorted(winning):
                return (True, idx + 1, "box")
        elif play == "straight_box":
            if num == winning:
                return (True, idx + 1, "straight")
            if sorted(num) == sorted(winning):
                return (True, idx + 1, "box")
        elif play == "combo":
            if sorted(num) == sorted(winning):
                return (True, idx + 1, "combo")
    return (False, 0, "")


def compute_payout(item: dict, results: dict, payouts: dict) -> float:
    won, pos, mode = check_win(item, results)
    if not won:
        return 0.0
    cfg = payouts.get(item["game"], {})
    rate = float(cfg.get(mode, 0) or 0)
    # position multiplier (winner 1 = 100%, 2 = 50%, 3 = 25%)
    pos_mult = {1: 1.0, 2: 0.5, 3: 0.25}.get(pos, 0)
    base_amount = float(item["amount"])
    if mode == "combo":
        return base_amount * rate * pos_mult
    return base_amount * rate * pos_mult


@api.post("/tickets")
async def create_ticket(data: TicketCreate, user=Depends(current_user)):
    lottery = await db.lotteries.find_one({"id": data.lottery_id}, {"_id": 0})
    if not lottery:
        raise HTTPException(404, "Loterie introuvable")
    items = []
    total = 0.0
    for it in data.items:
        line_total = calc_item_total(it)
        total += line_total
        items.append({**it.model_dump(), "line_total": line_total})

    # ticket number
    from pymongo import ReturnDocument
    seq_doc = await db.counters.find_one_and_update(
        {"id": "ticket_seq"}, {"$inc": {"value": 1}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    seq = (seq_doc or {}).get("value", 1)
    ticket_number = f"TL{datetime.now().strftime('%y%m%d')}{seq:05d}"

    doc = {
        "id": gen_id(),
        "ticket_number": ticket_number,
        "lottery_id": data.lottery_id,
        "lottery_name": lottery["name"],
        "draw_date": data.draw_date,
        "currency": data.currency,
        "items": items,
        "total": total,
        "customer_name": data.customer_name or "",
        "machann_id": user["id"],
        "machann_name": user["name"],
        "agency_id": user.get("agency_id"),
        "status": "active",
        "payout_amount": 0.0,
        "paid": False,
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
    tickets = await db.tickets.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return tickets


@api.get("/tickets/{ticket_number}")
async def get_ticket(ticket_number: str, user=Depends(current_user)):
    t = await db.tickets.find_one({"ticket_number": ticket_number}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    # compute winning status if result exists
    result = await db.results.find_one({"lottery_id": t["lottery_id"], "draw_date": t["draw_date"]}, {"_id": 0})
    settings = await get_settings_doc()
    payouts = settings.get("payouts", {})
    if result:
        total_win = 0.0
        for it in t["items"]:
            payout = compute_payout(it, result, payouts)
            it["winning"] = payout > 0
            it["payout"] = payout
            total_win += payout
        t["payout_amount"] = total_win
        t["has_result"] = True
    else:
        t["has_result"] = False
    return t


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
    total_win = 0.0
    for it in t["items"]:
        total_win += compute_payout(it, result, payouts_cfg)
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


@api.delete("/tickets/{ticket_number}")
async def cancel_ticket(ticket_number: str, user=Depends(require_roles("super_admin", "admin"))):
    await db.tickets.update_one({"ticket_number": ticket_number}, {"$set": {"status": "cancelled"}})
    await audit(user["id"], "ticket.cancel", {"ticket": ticket_number})
    return {"ok": True}


# ---------- Routes: Results ----------
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
    return await db.results.find(q, {"_id": 0}).sort("draw_date", -1).to_list(200)


@api.post("/results")
async def upsert_result(data: ResultCreate, user=Depends(require_roles("super_admin", "admin", "directeur"))):
    doc = {
        "lottery_id": data.lottery_id, "draw_date": data.draw_date,
        "pick3": data.pick3 or [], "pick4": data.pick4 or [],
        "pick5": data.pick5 or [], "bolet": data.bolet or [],
        "updated_at": now_iso(), "updated_by": user["id"],
    }
    await db.results.update_one(
        {"lottery_id": data.lottery_id, "draw_date": data.draw_date},
        {"$set": doc, "$setOnInsert": {"id": gen_id(), "created_at": now_iso()}},
        upsert=True,
    )
    await audit(user["id"], "result.upsert", {"lottery": data.lottery_id, "date": data.draw_date})
    return doc


# ---------- Routes: Dashboard ----------
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
    by_lottery: Dict[str, float] = {}
    by_currency: Dict[str, float] = {"HTG": 0.0, "BRL": 0.0}

    async for t in db.tickets.find(q, {"_id": 0}):
        sales_total += float(t.get("total", 0))
        tickets_sold += 1
        if t.get("paid"):
            payments_total += float(t.get("payout_amount", 0))
        if t.get("payout_amount", 0) > 0:
            tickets_winning += 1
        by_lottery[t.get("lottery_name", "?")] = by_lottery.get(t.get("lottery_name", "?"), 0) + float(t.get("total", 0))
        cur = t.get("currency", "HTG")
        by_currency[cur] = by_currency.get(cur, 0) + float(t.get("total", 0))

    # last 7 days trend
    trend = []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        q2 = dict(q)
        q2["created_at"] = {"$gte": day, "$lt": (datetime.now(timezone.utc) - timedelta(days=i - 1)).strftime("%Y-%m-%d") if i > 0 else now_iso()[:30]}
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
        "by_currency": by_currency,
        "trend": trend,
        "recent_tickets": recent_tickets,
        "recent_results": recent_results,
    }


# ---------- Routes: Settings ----------
DEFAULT_PAYOUTS = {
    "bolet": {"straight": 60, "box": 30},
    "pick3": {"straight": 500, "box": 80, "combo": 80},
    "pick4": {"straight": 5000, "box": 200, "combo": 200},
    "pick5": {"straight": 50000, "box": 500, "combo": 500},
}
DEFAULT_LIMITS = {
    "per_number": 1000, "per_game": 5000, "per_lottery": 10000, "per_machann": 50000,
}


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
        doc.pop("_id", None)
    return doc


@api.get("/settings")
async def get_settings(user=Depends(current_user)):
    return await get_settings_doc()


@api.put("/settings")
async def update_settings(data: SettingsUpdate, user=Depends(require_roles("super_admin"))):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    await audit(user["id"], "settings.update", update)
    return await get_settings_doc()


# ---------- Routes: Reports ----------
@api.get("/reports/sales")
async def report_sales(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    group_by: str = "day",  # day, lottery, machann, agency
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

    rows: Dict[str, Dict[str, float]] = {}
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


# ---------- Routes: Audit & Transactions ----------
@api.get("/audit")
async def list_audit(user=Depends(require_roles("super_admin", "directeur"))):
    return await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(200)


@api.get("/payments")
async def list_payments(user=Depends(current_user)):
    return await db.payouts.find({}, {"_id": 0}).sort("paid_at", -1).to_list(200)


# ---------- Seed ----------
DEFAULT_LOTTERIES = [
    {"name": "New York Midday", "code": "NY_MID", "schedule": "12:30"},
    {"name": "New York Evening", "code": "NY_EVE", "schedule": "22:30"},
    {"name": "Georgia Midday", "code": "GA_MID", "schedule": "12:29"},
    {"name": "Georgia Evening", "code": "GA_EVE", "schedule": "18:59"},
    {"name": "Texas Morning", "code": "TX_MOR", "schedule": "10:12"},
    {"name": "Texas Evening", "code": "TX_EVE", "schedule": "22:12"},
    {"name": "Florida Midday", "code": "FL_MID", "schedule": "13:30"},
    {"name": "Florida Evening", "code": "FL_EVE", "schedule": "21:45"},
]


@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.tickets.create_index("ticket_number", unique=True)
    await db.results.create_index([("lottery_id", 1), ("draw_date", 1)], unique=True)

    # Seed lotteries
    for lot in DEFAULT_LOTTERIES:
        if not await db.lotteries.find_one({"code": lot["code"]}):
            await db.lotteries.insert_one({"id": gen_id(), **lot, "active": True})

    # Seed super admin
    if not await db.users.find_one({"role": "super_admin"}):
        await db.users.insert_one({
            "id": gen_id(),
            "email": "admin@toplotto.ht",
            "password": hash_password("Admin123!"),
            "name": "Super Admin",
            "role": "super_admin",
            "active": True,
            "created_at": now_iso(),
        })
        logger.info("Seeded super admin: admin@toplotto.ht / Admin123!")

    # Seed default agency
    if not await db.agencies.find_one({}):
        await db.agencies.insert_one({
            "id": gen_id(), "name": "Agence Principale",
            "address": "Port-au-Prince", "phone": "+509 0000 0000",
            "active": True, "balance": 0.0, "created_at": now_iso(),
        })

    # Init settings
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
