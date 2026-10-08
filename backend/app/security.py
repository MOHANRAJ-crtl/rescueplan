"""Argon2 passwords; opaque, revocable server-side sessions; CSRF protection."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from fastapi import HTTPException, Request, Response
from pwdlib import PasswordHash

PASSWORDS = PasswordHash.recommended()
COOKIE = "rescueplan_session"
DUMMY_HASH = PASSWORDS.hash("unmatchable-dummy-" + secrets.token_hex(16))


def utcnow():
    return datetime.now(timezone.utc)


def token_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def public_user(user):
    return {key: user[key] for key in ("id", "name", "email", "role", "driverId") if key in user}


@dataclass(frozen=True)
class Actor:
    user: dict
    session_hash: str
    csrf_token: str


def issue_session(store, settings, user, response: Response):
    token = secrets.token_urlsafe(48)
    csrf = secrets.token_urlsafe(32)
    expires = utcnow() + timedelta(hours=settings.session_hours)
    store.sessions.insert_one({"_id": token_hash(token), "userId": user["id"],
                               "authVersion": user["authVersion"], "csrfToken": csrf,
                               "expiresAt": expires})
    response.set_cookie(COOKIE, token, max_age=settings.session_hours * 3600,
                        httponly=True, secure=settings.cookie_secure, samesite="strict", path="/")
    response.headers["Cache-Control"] = "no-store"
    return {"user": public_user(user), "csrfToken": csrf}


def authenticate(request: Request):
    token = request.cookies.get(COOKIE, "")
    if not token:
        raise HTTPException(401, "Please sign in.")
    store = request.app.state.store
    key = token_hash(token)
    session = store.sessions.find_one({"_id": key})
    expires = session.get("expiresAt") if session else None
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not session or not expires or expires <= utcnow():
        raise HTTPException(401, "Your session expired. Please sign in again.")
    user = next((u for u in store.read()["users"] if u["id"] == session["userId"]), None)
    if not user or user["authVersion"] != session["authVersion"]:
        raise HTTPException(401, "Your account changed. Please sign in again.")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        supplied = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(supplied, session["csrfToken"]):
            raise HTTPException(403, "The security token is missing or expired. Refresh and try again.")
    return Actor(user, key, session["csrfToken"])


def authorize(doc, actor: Actor, role=None):
    # Check again inside each atomic update, including account-version changes.
    user = next((u for u in doc["users"] if u["id"] == actor.user["id"]), None)
    if not user or user["authVersion"] != actor.user["authVersion"]:
        raise HTTPException(401, "Your account changed. Please sign in again.")
    if role and user["role"] != role:
        raise HTTPException(403, "This action is not available for your role.")
    return user


def enforce_origin(request: Request):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and origin != str(request.base_url).rstrip("/"):
            raise HTTPException(403, "Use the website and API from the same origin.")
        # HTML forms cannot send application/json. Unauthenticated setup/login
        # also require JSON, so cross-site form submission cannot log users in.
        if request.headers.get("content-type", "").split(";", 1)[0].strip() != "application/json":
            raise HTTPException(415, "Send application/json.")

