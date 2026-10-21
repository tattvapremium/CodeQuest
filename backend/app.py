import os, hashlib, hmac, secrets, json
from datetime import datetime, timedelta
from pathlib import Path
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models import db, User, Progress, ProjectContext

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env")
app = FastAPI(title="CodeQuest API")

# Set CORS_ORIGINS as a comma-separated list in backend/.env for deployed frontends.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_allowed_origins = [origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", _default_origins).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

class Auth(BaseModel): username: str; password: str
class ProgressIn(BaseModel): user_id: int; mission_index: int; completed: int; attempts: int; last_code: str = ""
class ContextIn(BaseModel): user_id: int; context: dict
def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 310000).hex()
    return f"pbkdf2_sha256$310000${salt}${digest}"

def _verify_password(password: str, stored: str) -> bool:
    try:
        if stored.startswith("pbkdf2_sha256$"):
            _, rounds, salt, expected = stored.split("$", 3)
            actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds)).hex()
            return hmac.compare_digest(actual, expected)
        # Backward compatibility for accounts created by the earlier prototype.
        return hmac.compare_digest(stored, hashlib.sha256(password.encode()).hexdigest())
    except (ValueError, TypeError):
        return False

class CoachIn(BaseModel):
    language: str = "Python"
    level: str = "beginner"
    concept: str
    goal: str
    code: str = ""
    output: str = ""
    learner_message: str = ""
    hint_level: int = 1

MISSIONS = [
 {"id":1,"title":"Print a Message","concept":"print()","goal":"Display a simple welcome message.","learn":"Python can display text with print().","starter":"# Write your own code here\n","hint":["Think about the function used to display text.","The function name is print.","Put your message inside print( )."]},
 {"id":2,"title":"Store a Name","concept":"Variables","goal":"Create a variable named name and display it.","learn":"A variable gives a value a name so your program can use it later.","starter":"# Create a variable and display it\n","hint":["First decide what information you need to remember.","Use a name on the left and a value on the right.","Then pass the variable to print()."]},
 {"id":3,"title":"Collect Marks","concept":"input()","goal":"Read a student's name and one mark, then display both.","learn":"input() lets a program receive text from the user.","starter":"# Read the student's details\n","hint":["Your program needs two pieces of information.","Use input() to receive each value.","Store each input in a variable, then print the values."]},
 {"id":4,"title":"Check Pass or Fail","concept":"if / else","goal":"Read a mark and display whether it is pass or fail using a condition.","learn":"if/else lets a program choose between two paths.","starter":"# Decide whether the student passed\n","hint":["Compare the mark with a pass boundary.","Put the true case under if and the other case under else.","Remember that the condition must evaluate to True or False."]},
 {"id":5,"title":"Build the Result","concept":"loops + totals","goal":"Read three marks, calculate their total, and display it.","learn":"Loops repeat a block of code so you do not have to write the same step many times.","starter":"# Build a total from three marks\n","hint":["Think about repeating the input step three times.","A loop can repeat a block while a counter changes.","Keep a running total and add each mark to it."]},
]

@app.get("/health")
def health(): return {"ok": True, "ai": bool(os.getenv("GEMINI_API_KEY"))}

@app.post("/auth/register")
def register(a: Auth, s: Session = Depends(db)):
    if s.query(User).filter(User.username==a.username).first(): raise HTTPException(409,"Username already exists")
    u=User(username=a.username, password=_hash_password(a.password)); s.add(u); s.commit(); s.refresh(u)
    s.add(Progress(user_id=u.id)); s.commit(); return {"user":{"id":u.id,"username":u.username}}

@app.post("/auth/login")
def login(a: Auth, s: Session = Depends(db)):
    u=s.query(User).filter(User.username==a.username).first()
    if not u or not _verify_password(a.password, u.password): raise HTTPException(401,"Invalid username or password")
    if not u.password.startswith("pbkdf2_sha256$"):
        u.password = _hash_password(a.password); s.commit()
    return {"user":{"id":u.id,"username":u.username}}

@app.get("/missions")
def missions(): return MISSIONS

@app.get("/progress/{user_id}")
def get_progress(user_id:int,s:Session=Depends(db)):
    p=s.query(Progress).filter(Progress.user_id==user_id).first()
    if not p: raise HTTPException(404,"Progress not found")
    return {"mission_index":p.mission_index,"completed":p.completed,"attempts":p.attempts,"last_code":p.last_code}

@app.post("/progress")
def save_progress(x:ProgressIn,s:Session=Depends(db)):
    p=s.query(Progress).filter(Progress.user_id==x.user_id).first()
    if not p: p=Progress(user_id=x.user_id); s.add(p)
    p.mission_index=x.mission_index; p.completed=x.completed; p.attempts=x.attempts; p.last_code=x.last_code; s.commit()
    return {"ok":True}

@app.get("/context/{user_id}")
def get_project_context(user_id: int, s: Session = Depends(db)):
    row = s.query(ProjectContext).filter(ProjectContext.user_id == user_id).first()
    now = datetime.utcnow()
    if not row:
        return {"context": None, "expired": False}
    if row.expires_at <= now:
        fresh = {
            "schema_version": 1, "user_id": user_id, "language": "Python",
            "project": {"title": "", "idea": "", "requirements": [], "target_users": "", "constraints": ["Free tools"], "finalized": False},
            "journey": {"started_at": now.isoformat() + "Z", "expires_at": (now + timedelta(days=30)).isoformat() + "Z", "current_day": 1, "lesson_id": "lesson-1", "lesson_step": 1, "completed_lessons": [], "status": "planning"},
            "workspace": {"persistent_file_name": "phone_selector.py", "code_snapshot": "# Start coding here\n", "last_output": "", "last_run_status": "idle", "updated_at": now.isoformat() + "Z"},
            "chat_history": [], "usage": {"coach_requests_today": 0, "last_request_date": now.date().isoformat()}
        }
        row.context_json = json.dumps(fresh); row.created_at = now; row.updated_at = now; row.expires_at = now + timedelta(days=30)
        s.commit()
        return {"context": fresh, "expired": True}
    try:
        return {"context": json.loads(row.context_json), "expired": False}
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(500, "Saved project context is unreadable")

@app.post("/context")
def save_project_context(x: ContextIn, s: Session = Depends(db)):
    now = datetime.utcnow(); context = x.context
    journey = context.get("journey") if isinstance(context.get("journey"), dict) else {}
    started_raw = journey.get("started_at")
    try:
        started = datetime.fromisoformat(str(started_raw).replace("Z", "+00:00")).replace(tzinfo=None) if started_raw else now
    except ValueError:
        started = now
    if started > now + timedelta(minutes=5): started = now
    expires = min(started + timedelta(days=30), now + timedelta(days=30))
    journey["started_at"] = started.isoformat() + "Z"; journey["expires_at"] = expires.isoformat() + "Z"
    context["journey"] = journey; context["user_id"] = x.user_id
    row = s.query(ProjectContext).filter(ProjectContext.user_id == x.user_id).first()
    if not row:
        if not s.query(User).filter(User.id == x.user_id).first(): raise HTTPException(404, "User not found")
        row = ProjectContext(user_id=x.user_id, context_json=json.dumps(context), created_at=now, updated_at=now, expires_at=expires); s.add(row)
    else:
        row.context_json = json.dumps(context); row.updated_at = now; row.expires_at = expires
    s.commit()
    return {"ok": True, "expires_at": expires.isoformat() + "Z"}

@app.post("/coach")
async def coach(x:CoachIn):
    api=os.getenv("GEMINI_API_KEY", "").strip()
    system=("You are QAI, CodeQuest's patient peer-coach for a beginner. Reply in simple Hinglish when the learner uses Hinglish. "
            "Teach thinking, not copying. Never give a complete copy-paste solution or rewrite all of the learner's code. "
            "Give one small actionable hint, point out one logical issue at a time, and ask at most one guiding question. "
            "During project discovery, ask one friendly question at a time about the real problem, target user, constraints, and success criteria; do not invent requirements or claim the project is finalized without learner confirmation. "
            "Keep replies concise and technically accurate. Refer to the learner's existing code instead of replacing it.")
    prompt=f"""{system}\n\nLanguage: {x.language}\nLevel: {x.level}\nConcept: {x.concept}\nGoal: {x.goal}\nCurrent code:\n{x.code}\nOutput/error:\n{x.output}\nLearner message: {x.learner_message}\nHint level: {x.hint_level}\nRespond as a coach, not an answer generator."""
    if not api:
        return {"source":"local","reply":"Start with the smallest part of the goal. Ask yourself: what information does the program need, and what Python feature can handle that?"}
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 250,
            "thinkingConfig": {"thinkingLevel": "minimal"},
        },
    }
    try:
        timeout = httpx.Timeout(60.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            # The API key is kept server-side; it is never sent to the browser.
            response = await client.post(url, params={"key": api}, json=payload)
            response.raise_for_status()
            data = response.json()
            candidates = data.get("candidates") or []
            parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
            reply = "\n".join(part.get("text", "") for part in parts if part.get("text"))
            if not reply.strip():
                return {"source": "local-fallback", "reply": "AI Coach did not return a text hint. Try asking again."}
            return {"source": "gemini", "reply": reply.strip()}
    except httpx.TimeoutException:
        return {"source": "local-fallback", "reply": "AI Coach timed out. Use the mission hint and try again.", "error": "Gemini API request timed out."}
    except httpx.HTTPStatusError as exc:
        # Do not include the request URL or response body: they may contain sensitive details.
        return {"source": "local-fallback", "reply": "AI Coach is temporarily unavailable. Use the mission hint and try again.", "error": f"Gemini API returned HTTP {exc.response.status_code}. Check the model name, API key, and API access."}
    except (httpx.RequestError, ValueError, KeyError, IndexError):
        return {"source": "local-fallback", "reply": "AI Coach is temporarily unavailable. Use the mission hint and try again.", "error": "Gemini API response could not be processed."}
