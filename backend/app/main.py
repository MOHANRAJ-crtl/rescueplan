"""Run from the project root: python run.py. No separate frontend server."""
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from threading import Lock
import time

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pymongo.errors import PyMongoError

from .config import PROJECT_ROOT, Settings
from .schemas import (
    Account,
    AssignmentInput,
    DriverInput,
    LocationInput,
    Login,
    OrderInput,
    OrderProgress,
    PlanProgress,
    ReasonInput,
    ReportInput,
    StockInput,
    VehicleInput,
)
from .security import (
    COOKIE,
    DUMMY_HASH,
    PASSWORDS,
    authenticate,
    enforce_origin,
    issue_session,
    public_user,
)
from .service import Service
from .store import Store


def create_app(settings=None, client=None):
    settings = settings or Settings.from_env()
    store = Store(settings, client)
    service = Service(store)

    @asynccontextmanager
    async def lifespan(application):
        try:
            store.initialize()
        except PyMongoError:
            store.close()
            raise RuntimeError(
                "Cannot connect to MongoDB. Start MongoDB locally or check "
                "MONGODB_URI in .env and your Atlas network access."
            ) from None

        try:
            yield
        finally:
            store.close()

    app = FastAPI(
        title="RescuePlan API",
        version="1.0.0",
        lifespan=lifespan,
        dependencies=[Depends(enforce_origin)],
    )

    app.state.store = store
    app.state.service = service

    failures = defaultdict(deque)
    throttle_lock = Lock()

    def check_throttle(request):
        key = request.client.host if request.client else "local"

        with throttle_lock:
            now = time.monotonic()
            queue = failures[key]

            while queue and queue[0] <= now - 300:
                queue.popleft()

            if len(queue) >= 15:
                raise HTTPException(
                    429,
                    "Too many failed sign-ins. Try again in five minutes.",
                )

            if len(failures) > 5000:
                for old in list(failures):
                    if not failures[old] or failures[old][-1] <= now - 300:
                        failures.pop(old, None)

        return key

    @app.middleware("http")
    async def headers(request, call_next):
        length = request.headers.get("content-length", "0")

        if not length.isdigit() or int(length) > 32768:
            return JSONResponse(
                {"detail": "Request is too large."},
                status_code=413,
            )

        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = (
            "strict-origin-when-cross-origin"
        )
        response.headers["X-Frame-Options"] = "DENY"

        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"

        if request.url.path not in ("/docs", "/redoc"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' https://unpkg.com; "
                "style-src 'self' 'unsafe-inline' "
                "https://fonts.googleapis.com https://unpkg.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: "
                "https://tile.openstreetmap.org https://unpkg.com; "
                "connect-src 'self'; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "frame-ancestors 'none';"
            )

        return response

    @app.exception_handler(PyMongoError)
    async def database_error(request, error):
        return JSONResponse(
            {
                "detail": (
                    "MongoDB is unavailable. "
                    "Check the database connection and retry."
                )
            },
            status_code=503,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        messages = [
            f"{'.'.join(str(p) for p in e['loc'] if p != 'body')}: {e['msg']}"
            for e in error.errors()
        ]

        return JSONResponse(
            {"detail": "; ".join(messages)},
            status_code=422,
        )

    @app.get("/api/health")
    def health():
        store.client.admin.command("ping")
        return {"status": "ok", "database": "connected"}

    @app.get("/api/auth/setup-status")
    def setup_status():
        return {"setupRequired": not bool(store.read()["users"])}

    @app.post("/api/auth/setup", status_code=201)
    def setup(data: Account, response: Response):
        user = service.setup(data)
        return issue_session(store, settings, user, response)

    @app.post("/api/auth/login")
    def login(data: Login, request: Request, response: Response):
        key = check_throttle(request)

        user = next(
            (
                u
                for u in store.read()["users"]
                if u["email"] == data.email
            ),
            None,
        )

        try:
            valid = PASSWORDS.verify(
                data.password,
                user["passwordHash"] if user else DUMMY_HASH,
            )
        except Exception:
            valid = False

        if not valid or not user or user["role"] != data.role:
            with throttle_lock:
                failures[key].append(time.monotonic())

            raise HTTPException(
                401,
                "Email or password is incorrect for this portal.",
            )

        old = request.cookies.get(COOKIE)

        if old:
            from .security import token_hash

            store.sessions.delete_one({"_id": token_hash(old)})

        return issue_session(store, settings, user, response)

    @app.get("/api/auth/me")
    def me(actor=Depends(authenticate)):
        return {
            "user": public_user(actor.user),
            "csrfToken": actor.csrf_token,
        }

    @app.post("/api/auth/logout")
    def logout(response: Response, actor=Depends(authenticate)):
        store.sessions.delete_one({"_id": actor.session_hash})

        response.delete_cookie(
            COOKIE,
            httponly=True,
            secure=settings.cookie_secure,
            samesite="strict",
            path="/",
        )

        return {"ok": True}

    @app.get("/api/state")
    def state(actor=Depends(authenticate)):
        return service.state(actor)

    @app.post("/api/admins", status_code=201)
    def add_admin(data: Account, actor=Depends(authenticate)):
        return service.add_admin(actor, data)

    @app.post("/api/vehicles", status_code=201)
    def add_vehicle(data: VehicleInput, actor=Depends(authenticate)):
        return service.add_vehicle(actor, data)

    @app.post("/api/drivers", status_code=201)
    def add_driver(data: DriverInput, actor=Depends(authenticate)):
        return service.save_driver(actor, data)

    @app.patch("/api/drivers/{driver_id}")
    def edit_driver(
        driver_id: str,
        data: DriverInput,
        actor=Depends(authenticate),
    ):
        return service.save_driver(actor, data, driver_id)

    @app.post("/api/drivers/{driver_id}/vehicle-ready")
    def vehicle_ready(driver_id: str, actor=Depends(authenticate)):
        return service.vehicle_ready(actor, driver_id)

    @app.patch("/api/me/location")
    def location(data: LocationInput, actor=Depends(authenticate)):
        return service.location(actor, data)

    @app.post("/api/orders", status_code=201)
    def add_order(data: OrderInput, actor=Depends(authenticate)):
        return service.add_order(actor, data)

    @app.patch("/api/orders/{order_id}/status")
    def update_order(
        order_id: str,
        data: OrderProgress,
        actor=Depends(authenticate),
    ):
        return service.progress_order(actor, order_id, data)

    @app.post("/api/incidents", status_code=201)
    def submit_report(data: ReportInput, actor=Depends(authenticate)):
        return service.submit_report(actor, data)

    @app.post("/api/incidents/{incident_id}/verify")
    def verify(incident_id: str, actor=Depends(authenticate)):
        return service.verify_report(actor, incident_id)

    @app.post("/api/incidents/{incident_id}/reject")
    def reject(
        incident_id: str,
        data: ReasonInput,
        actor=Depends(authenticate),
    ):
        return service.reject_report(actor, incident_id, data)

    @app.post("/api/incidents/{incident_id}/resolve")
    def resolve(incident_id: str, actor=Depends(authenticate)):
        return service.resolve_report(actor, incident_id)

    @app.post("/api/incidents/{incident_id}/plan")
    def generate(incident_id: str, actor=Depends(authenticate)):
        return service.generate_plan(actor, incident_id)

    @app.post("/api/plans/{plan_id}/assign")
    def assign(
        plan_id: str,
        data: AssignmentInput,
        actor=Depends(authenticate),
    ):
        return service.assign_plan(actor, plan_id, data)

    @app.patch("/api/plans/{plan_id}/status")
    def advance(
        plan_id: str,
        data: PlanProgress,
        actor=Depends(authenticate),
    ):
        return service.progress_plan(actor, plan_id, data)

    @app.post("/api/stock", status_code=201)
    def add_stock(data: StockInput, actor=Depends(authenticate)):
        return service.save_stock(actor, data)

    @app.patch("/api/stock/{stock_id}")
    def edit_stock(
        stock_id: str,
        data: StockInput,
        actor=Depends(authenticate),
    ):
        return service.save_stock(actor, data, stock_id)

    @app.post("/api/notifications/read")
    def mark_read(actor=Depends(authenticate)):
        return service.read_notifications(actor)

    app.mount(
        "/",
        StaticFiles(directory=PROJECT_ROOT / "frontend", html=True),
        name="frontend",
    )

    return app


app = create_app()