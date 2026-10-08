"""API/security/workflow tests. A fake MongoDB client is used only in tests.

Set RESCUEPLAN_TEST_MONGODB_URI to run against a real MongoDB server instead.
Every test uses a randomly named database and removes only that database.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import json
import os
from threading import Barrier, local
from uuid import uuid4

from fastapi.testclient import TestClient
import mongomock
from pymongo import MongoClient
import pytest

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.security import COOKIE, PASSWORDS, authenticate, token_hash, utcnow

PASSWORD = "Local-test-password#42"
REPORT = {"type": "Engine failure", "urgency": "High", "location": "Kondalampatti junction, Salem",
          "description": "Vehicle safely parked. Cargo remains on board."}


class Browser:
    def __init__(self, app, email=None, role="driver"):
        self.client = TestClient(app)
        self.csrf = None
        if email:
            response = self.client.post("/api/auth/login", json={"email": email, "password": PASSWORD, "role": role})
            assert response.status_code == 200, response.text
            self.csrf = response.json()["csrfToken"]

    def send(self, method, path, data=None, **kwargs):
        headers = {"X-CSRF-Token": self.csrf} if self.csrf else {}
        headers.update(kwargs.pop("headers", {}))
        return self.client.request(method, path, json=data if data is not None else {}, headers=headers, **kwargs)

    def post(self, path, data=None, **kwargs):
        return self.send("POST", path, data, **kwargs)

    def patch(self, path, data=None, **kwargs):
        return self.send("PATCH", path, data, **kwargs)

    def state(self):
        response = self.client.get("/api/state")
        assert response.status_code == 200, response.text
        return response.json()


@pytest.fixture
def system():
    uri = os.getenv("RESCUEPLAN_TEST_MONGODB_URI")
    mongo = MongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=5000) if uri else mongomock.MongoClient(tz_aware=True)
    database = "rescueplan_test_" + uuid4().hex
    app = create_app(Settings(database=database), mongo)
    try:
        with TestClient(app):
            yield app
    finally:
        mongo.drop_database(database)
        mongo.close()


@pytest.fixture
def workspace(system):
    admin = Browser(system)
    response = admin.post("/api/auth/setup", {"name": "Operations Admin", "email": "ADMIN@gmail.com", "password": PASSWORD})
    assert response.status_code == 201, response.text
    admin.csrf = response.json()["csrfToken"]
    drivers = []
    for n, name in enumerate(("Arjun", "Ravi", "Meera", "Priya"), start=1):
        v = admin.post("/api/vehicles", {"registration": f"TN 30 TEST {n}", "type": "Cargo van", "capacityKg": 750 if n < 4 else 100})
        assert v.status_code == 201
        payload = {"name": name, "email": f"{name.lower()}@gmail.com", "phone": f"900001000{n}",
                   "password": PASSWORD, "distanceKm": n * 3, "vehicleId": v.json()["id"], "status": "Available"}
        d = admin.post("/api/drivers", payload)
        assert d.status_code == 201, d.text
        drivers.append({"id": d.json()["id"], "vehicleId": v.json()["id"], "email": payload["email"], "data": payload})
    return {"app": system, "admin": admin, "drivers": drivers}


def create_order(ws, index=0, weight=280):
    response = ws["admin"].post("/api/orders", {"customer": "Green Basket", "destination": "Fairlands, Salem",
         "pickup": "Salem central hub", "weightKg": weight, "driverId": ws["drivers"][index]["id"],
         "dueAt": (utcnow() + timedelta(hours=2)).isoformat()})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def draft_plan(ws, index=0, weight=280):
    order_id = create_order(ws, index, weight)
    original = Browser(ws["app"], ws["drivers"][index]["email"])
    response = original.post("/api/incidents", REPORT)
    assert response.status_code == 201, response.text
    case = response.json()["id"]
    assert ws["admin"].post(f"/api/incidents/{case}/verify").status_code == 200
    generated = ws["admin"].post(f"/api/incidents/{case}/plan")
    assert generated.status_code == 200, generated.text
    return original, order_id, case, generated.json()["id"]


def test_first_admin_setup_once_and_real_email(system):
    c = Browser(system)
    assert c.client.get("/api/auth/setup-status").json() == {"setupRequired": True}
    assert c.client.get("/api/state").status_code == 401
    payload = {"name": "Owner", "email": "owner@gmail.com", "password": PASSWORD}
    setup = c.post("/api/auth/setup", payload)
    assert setup.status_code == 201
    assert setup.json()["user"]["email"] == payload["email"]
    assert c.client.get("/api/auth/setup-status").json() == {"setupRequired": False}
    assert c.post("/api/auth/setup", payload).status_code == 409
    doc = system.state.store.read()
    assert len(doc["users"]) == 1
    assert PASSWORDS.verify(PASSWORD, doc["users"][0]["passwordHash"])
    assert PASSWORD not in json.dumps(doc)


def test_cookie_sessions_logout_and_password_storage(workspace):
    app, admin = workspace["app"], workspace["admin"]
    cookies = admin.client.cookies
    token = cookies.get(COOKIE)
    stored = app.state.store.sessions.find_one({"_id": token_hash(token)})
    assert stored and token not in json.dumps(stored, default=str)
    sign_in = Browser(app).post("/api/auth/login", {"email": "admin@gmail.com", "password": PASSWORD, "role": "admin"})
    assert "HttpOnly" in sign_in.headers["set-cookie"]
    assert "SameSite=strict" in sign_in.headers["set-cookie"]
    assert admin.post("/api/auth/logout").status_code == 200
    admin.client.cookies.set(COOKIE, token)
    assert admin.client.get("/api/state").status_code == 401


@pytest.mark.parametrize("payload", [
    {"email": "admin@gmail.com", "password": "wrongpassword", "role": "admin"},
    {"email": "admin@gmail.com", "password": PASSWORD, "role": "driver"},
    {"email": "unknown@gmail.com", "password": PASSWORD, "role": "admin"},
])
def test_wrong_credentials_or_portal_rejected(workspace, payload):
    assert Browser(workspace["app"]).post("/api/auth/login", payload).status_code == 401


def test_expired_session_rejected(workspace):
    a = workspace["admin"]
    workspace["app"].state.store.sessions.update_one({"_id": token_hash(a.client.cookies.get(COOKIE))},
                      {"$set": {"expiresAt": utcnow() - timedelta(seconds=1)}})
    assert a.client.get("/api/state").status_code == 401


def test_csrf_and_cross_origin_requests_rejected(workspace):
    a = workspace["admin"]
    payload = {"registration": "TEST 2", "type": "Cargo van", "capacityKg": 750}
    assert a.client.post("/api/vehicles", json=payload).status_code == 403
    assert a.post("/api/vehicles", payload, headers={"X-CSRF-Token": "wrong"}).status_code == 403
    assert a.post("/api/vehicles", payload, headers={"Origin": "https://external.example"}).status_code == 403
    assert a.client.post("/api/auth/login", data={"email": "admin@gmail.com", "password": PASSWORD, "role": "admin"}).status_code == 415
    assert a.post("/api/vehicles", payload, headers={"Origin": "http://testserver"}).status_code == 201


@pytest.mark.parametrize("path,payload", [
    ("/api/vehicles", {"registration": "TEST", "type": "Cargo van", "capacityKg": 750}),
    ("/api/admins", {"name": "Fake Admin", "email": "fake@gmail.com", "password": PASSWORD}),
    ("/api/stock", {"name": "Boxes", "category": "Other", "unit": "units", "quantity": 10, "warehouse": "Hub"}),
    ("/api/incidents/GUESSED/verify", {}),
    ("/api/plans/GUESSED/assign", {"driverId": "GUESSED"}),
])
def test_driver_cannot_call_admin_routes(workspace, path, payload):
    d = Browser(workspace["app"], workspace["drivers"][0]["email"])
    before = workspace["admin"].state()["revision"]
    assert d.post(path, payload).status_code == 403
    assert workspace["admin"].state()["revision"] == before


def test_admin_cannot_impersonate_driver_report(workspace):
    assert workspace["admin"].post("/api/incidents", REPORT).status_code == 403
    assert workspace["admin"].patch("/api/me/location", {"location": "Hub"}).status_code == 403


def test_full_recovery_flow_and_driver_privacy(workspace):
    ws = workspace
    original, order_id, case, plan_id = draft_plan(ws)
    admin, app = ws["admin"], ws["app"]
    assert admin.post(f"/api/incidents/{case}/plan").json()["id"] == plan_id  # one plan per case
    p = next(p for p in admin.state()["plans"] if p["id"] == plan_id)
    assert [c["driverId"] for c in p["candidates"]] == [ws["drivers"][1]["id"], ws["drivers"][2]["id"]]
    # Priya's closer/smaller vehicle would still be excluded by payload.
    replacement = ws["drivers"][1]
    assigned = admin.post(f"/api/plans/{plan_id}/assign", {"driverId": replacement["id"]})
    assert assigned.status_code == 200
    rescuer = Browser(app, replacement["email"])
    visible = rescuer.state()
    assert visible["orders"][0]["id"] == order_id
    assert visible["orders"][0]["driverId"] == replacement["id"]
    assert visible["incidents"][0]["location"] == REPORT["location"]
    assert any(n.get("planId") == plan_id for n in visible["notifications"])
    assert "candidates" not in visible["plans"][0]
    assert "passwordHash" not in json.dumps(visible)
    assert "users" not in visible
    assert not visible["stock"] and not visible["activity"]
    unrelated = Browser(app, ws["drivers"][2]["email"])
    assert not unrelated.state()["orders"] and not unrelated.state()["incidents"]
    assert [d["id"] for d in unrelated.state()["drivers"]] == [ws["drivers"][2]["id"]]
    assert unrelated.patch(f"/api/plans/{plan_id}/status", {"status": "Accepted"}).status_code == 403
    assert original.patch(f"/api/orders/{order_id}/status", {"status": "Delivered"}).status_code == 403
    assert rescuer.patch(f"/api/orders/{order_id}/status", {"status": "In transit"}).status_code == 409
    assert rescuer.patch(f"/api/plans/{plan_id}/status", {"status": "Completed"}).status_code == 409
    for step in ("Accepted", "Picked up", "Completed"):
        updated = rescuer.patch(f"/api/plans/{plan_id}/status", {"status": step})
        assert updated.status_code == 200, updated.text
        assert updated.json()["status"] == step
    final = admin.state()
    assert next(o for o in final["orders"] if o["id"] == order_id)["status"] == "Delivered"
    assert next(i for i in final["incidents"] if i["id"] == case)["status"] == "Resolved"
    assert next(d for d in final["drivers"] if d["id"] == replacement["id"])["status"] == "Available"
    assert next(v for v in final["vehicles"] if v["id"] == ws["drivers"][0]["vehicleId"])["status"] == "Breakdown"
    assert any(n["title"] == "Recovery completed" for n in original.state()["notifications"])
    assert rescuer.patch(f"/api/plans/{plan_id}/status", {"status": "Completed"}).status_code == 409
    assert admin.post(f"/api/drivers/{ws['drivers'][0]['id']}/vehicle-ready").status_code == 200


def test_duplicate_report_and_unverified_plan_blocked(workspace):
    create_order(workspace)
    d = Browser(workspace["app"], workspace["drivers"][0]["email"])
    case = d.post("/api/incidents", REPORT).json()["id"]
    assert d.post("/api/incidents", REPORT).status_code == 409
    assert workspace["admin"].post(f"/api/incidents/{case}/plan").status_code == 409
    assert workspace["admin"].post(f"/api/drivers/{workspace['drivers'][0]['id']}/vehicle-ready").status_code == 409


def test_rejection_pauses_until_admin_confirms_repairs(workspace):
    order_id = create_order(workspace)
    d = Browser(workspace["app"], workspace["drivers"][0]["email"])
    assert d.patch(f"/api/orders/{order_id}/status", {"status": "In transit"}).status_code == 200
    case = d.post("/api/incidents", REPORT).json()["id"]
    assert workspace["admin"].post(f"/api/incidents/{case}/reject", {"reason": "Vehicle inspection needed"}).status_code == 200
    assert d.state()["orders"][0]["status"] == "Disrupted"
    assert d.patch(f"/api/orders/{order_id}/status", {"status": "Delivered"}).status_code == 409
    assert workspace["admin"].post(f"/api/drivers/{workspace['drivers'][0]['id']}/vehicle-ready").status_code == 200
    assert d.state()["orders"][0]["status"] == "In transit"
    assert d.patch(f"/api/orders/{order_id}/status", {"status": "Delivered"}).status_code == 200


def test_vehicle_only_report_can_be_closed_after_verification(workspace):
    d = Browser(workspace["app"], workspace["drivers"][0]["email"])
    case = d.post("/api/incidents", REPORT).json()["id"]
    assert workspace["admin"].post(f"/api/incidents/{case}/resolve").status_code == 409
    assert workspace["admin"].post(f"/api/incidents/{case}/verify").status_code == 200
    assert workspace["admin"].post(f"/api/incidents/{case}/resolve").status_code == 200
    assert d.state()["drivers"][0]["status"] == "Breakdown"


def test_candidate_availability_rechecked_when_approving(workspace):
    _, _, _, plan_id = draft_plan(workspace)
    create_order(workspace, index=1)
    response = workspace["admin"].post(f"/api/plans/{plan_id}/assign", {"driverId": workspace["drivers"][1]["id"]})
    assert response.status_code == 409
    p = next(p for p in workspace["admin"].state()["plans"] if p["id"] == plan_id)
    assert p["status"] == "Draft"
    assert workspace["drivers"][1]["id"] not in [c["driverId"] for c in p["candidates"]]


def test_two_admins_cannot_assign_one_driver_to_two_recoveries(workspace, monkeypatch):
    ws = workspace
    _, _, _, p1 = draft_plan(ws, index=0)
    _, _, _, p2 = draft_plan(ws, index=2)
    app = ws["app"]
    # Force both requests to read the same revision before either writes it.
    real_read = app.state.store.read
    thread_state = local()
    barrier = Barrier(2)

    def synchronized_read():
        doc = real_read()
        count = getattr(thread_state, "reads", 0) + 1
        thread_state.reads = count
        if count == 2:  # authenticate() first, mutate() second
            barrier.wait(timeout=10)
        return doc

    b1 = Browser(app, "admin@gmail.com", "admin")
    b2 = Browser(app, "admin@gmail.com", "admin")
    monkeypatch.setattr(app.state.store, "read", synchronized_read)
    def assign(browser, p):
        return browser.post(f"/api/plans/{p}/assign", {"driverId": ws["drivers"][1]["id"]}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(assign, b1, p1)
        f2 = pool.submit(assign, b2, p2)
        codes = [f1.result(), f2.result()]
    assert sorted(codes) == [200, 409]
    final = real_read()
    assigned = [p for p in final["plans"] if p["status"] == "Assigned"]
    assert len(assigned) == 1
    for p in final["plans"]:
        for o_id in p["orderIds"]:
            order = next(o for o in final["orders"] if o["id"] == o_id)
            assert order["status"] == ("Assigned" if p["status"] == "Assigned" else "Disrupted")


def test_password_change_revokes_existing_driver_login(workspace):
    d_record = workspace["drivers"][0]
    d = Browser(workspace["app"], d_record["email"])
    payload = {**d_record["data"], "password": "Changed-password#123"}
    assert workspace["admin"].patch(f"/api/drivers/{d_record['id']}", payload).status_code == 200
    assert d.client.get("/api/state").status_code == 401
    assert d.post("/api/auth/login", {"email": d_record["email"], "password": PASSWORD, "role": "driver"}).status_code == 401
    assert d.post("/api/auth/login", {"email": d_record["email"], "password": payload["password"], "role": "driver"}).status_code == 200


def test_driver_details_locked_during_active_delivery(workspace):
    create_order(workspace)
    data = {k: v for k, v in workspace["drivers"][0]["data"].items() if k != "password"}
    data["status"] = "Off duty"
    assert workspace["admin"].patch(f"/api/drivers/{workspace['drivers'][0]['id']}", data).status_code == 409
    data.pop("status")
    data.pop("vehicleId")
    data["phone"] = "9111111111"
    assert workspace["admin"].patch(f"/api/drivers/{workspace['drivers'][0]['id']}", data).status_code == 200
    assert workspace["admin"].state()["drivers"][0]["status"] == "On delivery"


def test_stock_location_notification_reads_and_shared_admin(workspace):
    a = workspace["admin"]
    stock = {"name": "Fresh boxes", "category": "Groceries", "quantity": 30, "unit": "boxes", "warehouse": "Custom warehouse"}
    s_id = a.post("/api/stock", stock).json()["id"]
    assert a.patch(f"/api/stock/{s_id}", {**stock, "quantity": 0}).json()["quantity"] == 0
    a.post("/api/admins", {"name": "Second Admin", "email": "second@gmail.com", "password": PASSWORD})
    b = Browser(workspace["app"], "second@gmail.com", "admin")
    assert b.state()["stock"] == a.state()["stock"]
    assert b.state()["drivers"] == a.state()["drivers"]
    d = Browser(workspace["app"], workspace["drivers"][0]["email"])
    assert d.patch("/api/me/location", {"location": "Salem central hub"}).status_code == 200
    assert a.state()["drivers"][0]["location"] == "Salem central hub"
    create_order(workspace)
    assert any(not n["read"] for n in d.state()["notifications"])
    assert d.post("/api/notifications/read").status_code == 200
    assert all(n["read"] for n in d.state()["notifications"])
    assert b.client.get("/api/state").headers["cache-control"] == "no-store"


def test_persistence_across_app_restart(workspace):
    ws = workspace
    create_order(ws)
    app = create_app(Settings(database=ws["app"].state.store.db.name), ws["app"].state.store.client)
    with TestClient(app):
        admin = Browser(app, "admin@gmail.com", "admin")
        assert len(admin.state()["orders"]) == 1
        assert len(admin.state()["drivers"]) == 4
        assert admin.client.get("/api/auth/setup-status").json()["setupRequired"] is False


def test_duplicates_invalid_inputs_and_private_files(workspace):
    a = workspace["admin"]
    assert a.post("/api/vehicles", {"registration": "tn30test1", "type": "Cargo van", "capacityKg": 750}).status_code == 409
    assert a.post("/api/drivers", workspace["drivers"][0]["data"]).status_code == 409
    bad = a.post("/api/stock", {"name": "Stock", "category": "Other", "quantity": -1, "unit": "units", "warehouse": "Hub"})
    assert bad.status_code == 422
    assert a.post("/api/vehicles", {"registration": "XX", "type": "Cargo van", "capacityKg": 0}).status_code == 422
    d = Browser(workspace["app"], workspace["drivers"][0]["email"])
    assert d.post("/api/incidents", {**REPORT, "driverId": workspace["drivers"][1]["id"]}).status_code == 422
    assert a.post("/api/orders", {"customer": "X", "destination": "Y", "pickup": "Z", "weightKg": 999,
                "driverId": workspace["drivers"][0]["id"], "dueAt": (utcnow()+timedelta(hours=1)).isoformat()}).status_code == 422
    assert a.client.get("/.env").status_code == 404
    assert a.client.get("/backend/app/config.py").status_code == 404
    assert a.client.get("/").status_code == 200
    assert a.client.get("/driver-login.html").status_code == 200
    assert a.client.get("/app.js").headers["x-content-type-options"] == "nosniff"

