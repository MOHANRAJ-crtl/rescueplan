"""All ownership checks and recovery state transitions run on the server."""
from copy import deepcopy
from datetime import datetime, timezone
import math
from uuid import uuid4

from fastapi import HTTPException

from .security import PASSWORDS, authorize, public_user, utcnow
from .store import PUBLIC_ARRAYS

CLOSED = {"Resolved", "Rejected"}


def stamp():
    return utcnow().isoformat()


def uid(prefix):
    return f"{prefix}-{uuid4().hex[:12].upper()}"


def find(doc, collection, item_id):
    item = next((x for x in doc[collection] if x["id"] == item_id), None)
    if item is None:
        raise HTTPException(404, f"{collection.capitalize()} record not found.")
    return item


def note(doc, target, title, body, **extra):
    doc["notifications"].insert(0, {"id": uid("N"), "target": target, "title": title,
                                   "body": body, "createdAt": stamp(), "read": False, **extra})
    # Keep at most 100 notifications per recipient rather than letting one busy
    # admin board evict all driver notifications.
    counts = {}
    kept = []
    for item in doc["notifications"]:
        counts[item["target"]] = counts.get(item["target"], 0) + 1
        if counts[item["target"]] <= 100:
            kept.append(item)
    doc["notifications"] = kept


def log(doc, text, icon="checkCircle"):
    doc["activity"].insert(0, {"id": uid("A"), "text": text, "icon": icon, "createdAt": stamp()})
    doc["activity"] = doc["activity"][:100]


def open_reports(doc, driver_id):
    return [i for i in doc["incidents"] if i["driverId"] == driver_id and i["status"] not in CLOSED]


def active_orders(doc, driver_id):
    return [o for o in doc["orders"] if o["driverId"] == driver_id and o["status"] != "Delivered"]


def available(doc, driver):
    v = find(doc, "vehicles", driver["vehicleId"])
    return (driver["status"] == "Available" and v["status"] == "Ready"
            and not active_orders(doc, driver["id"]) and not open_reports(doc, driver["id"])
            and not any(p.get("assignedDriverId") == driver["id"] and p["status"] != "Completed"
                        for p in doc["plans"]))


def candidates(doc, incident, weight):
    results = []
    for d in doc["drivers"]:
        v = find(doc, "vehicles", d["vehicleId"])
        if d["id"] != incident["driverId"] and available(doc, d) and v["capacityKg"] >= weight:
            distance = d["distanceKm"]
            results.append({"driverId": d["id"], "vehicleId": v["id"], "distanceKm": distance,
                            "etaMinutes": math.ceil(distance / 30 * 60 + 4)})
    return sorted(results, key=lambda c: (c["distanceKm"], c["driverId"]))


def release(doc, driver_id):
    d = find(doc, "drivers", driver_id)
    if d["status"] == "Breakdown":
        return
    if not active_orders(doc, driver_id) and not any(
            p.get("assignedDriverId") == driver_id and p["status"] != "Completed" for p in doc["plans"]):
        d["status"] = "Available"
        find(doc, "vehicles", d["vehicleId"])["status"] = "Ready"


def unique_email(doc, email, excluding=None):
    if any(u["email"] == email and u["id"] != excluding for u in doc["users"]):
        raise HTTPException(409, "That email is already used by another account.")


def account(data, role, password_hash, driver_id=None):
    user = {"id": uid("U"), "name": data.name, "email": data.email, "role": role,
            "passwordHash": password_hash, "authVersion": 1, "createdAt": stamp()}
    if driver_id:
        user["driverId"] = driver_id
    return user


class Service:
    def __init__(self, store):
        self.store = store

    def change(self, actor, role, action):
        def update(doc):
            user = authorize(doc, actor, role)
            return action(doc, user)
        return self.store.mutate(update)

    def setup(self, data):
        hashed = PASSWORDS.hash(data.password)

        def create(doc):
            if doc["users"]:
                raise HTTPException(409, "Setup is complete. Sign in or ask an admin to add your account.")
            user = account(data, "admin", hashed)
            doc["users"].append(user)
            log(doc, f"{user['name']} created the operations workspace.", "shield")
            return user
        return self.store.mutate(create)

    def add_admin(self, actor, data):
        hashed = PASSWORDS.hash(data.password)

        def create(doc, user):
            unique_email(doc, data.email)
            added = account(data, "admin", hashed)
            doc["users"].append(added)
            log(doc, f"{user['name']} added administrator {added['name']}.", "users")
            return public_user(added)
        return self.change(actor, "admin", create)

    def state(self, actor):
        doc = self.store.read()
        user = authorize(doc, actor)
        result = {"version": 1, "revision": doc["revision"], "user": public_user(user),
                  **{key: deepcopy(doc[key]) for key in PUBLIC_ARRAYS}}
        if user["role"] == "admin":
            for p in result["plans"]:
                if p["status"] == "Draft":
                    p["candidates"] = candidates(doc, find(doc, "incidents", p["incidentId"]), p["totalWeightKg"])
                    if not any(c["driverId"] == p.get("selectedDriverId") for c in p["candidates"]):
                        p["selectedDriverId"] = p["candidates"][0]["driverId"] if p["candidates"] else None
            result["notifications"] = [n for n in result["notifications"] if n["target"] == "admin"]
            result["admins"] = [public_user(u) for u in doc["users"] if u["role"] == "admin"]
            return result
        d_id = user["driverId"]
        # The API filters data, rather than hiding unrelated records in the UI.
        own_case_ids = {i["id"] for i in doc["incidents"] if i["driverId"] == d_id}
        relevant_plans = [p for p in doc["plans"] if p.get("assignedDriverId") == d_id
                          or p["incidentId"] in own_case_ids]
        case_ids = own_case_ids | {p["incidentId"] for p in relevant_plans}
        order_ids = {o_id for p in relevant_plans for o_id in p["orderIds"]}
        for i in doc["incidents"]:
            if i["id"] in case_ids:
                order_ids.update(i["orderIds"])
        result["orders"] = [o for o in result["orders"] if o["driverId"] == d_id or o["id"] in order_ids]
        result["incidents"] = [i for i in result["incidents"] if i["id"] in case_ids]
        result["plans"] = deepcopy(relevant_plans)
        for p in result["plans"]:
            p.pop("candidates", None)
            if not p.get("assignedDriverId"):
                p.pop("selectedDriverId", None)
        involved = {d_id} | {i["driverId"] for i in result["incidents"]}
        involved.update(p["assignedDriverId"] for p in relevant_plans if p.get("assignedDriverId"))
        result["drivers"] = []
        for d in doc["drivers"]:
            if d["id"] == d_id:
                result["drivers"].append(deepcopy(d))
            elif d["id"] in involved:
                # Only the contact information needed for this handover.
                result["drivers"].append({k: d[k] for k in ("id", "name", "phone", "vehicleId")})
        v_ids = {d["vehicleId"] for d in result["drivers"]} | {i["vehicleId"] for i in result["incidents"]}
        result["vehicles"] = [v for v in result["vehicles"] if v["id"] in v_ids]
        result["stock"] = []
        result["activity"] = []
        result["notifications"] = [n for n in result["notifications"] if n["target"] == d_id]
        return result

    def add_vehicle(self, actor, data):
        def create(doc, user):
            registration = data.registration.upper()
            key = "".join(registration.split())
            if any("".join(v["registration"].split()) == key for v in doc["vehicles"]):
                raise HTTPException(409, "This registration is already in the fleet.")
            v = {"id": uid("V"), **data.model_dump(), "registration": registration, "status": "Ready"}
            doc["vehicles"].append(v)
            log(doc, f"{user['name']} added vehicle {registration}.", "truck")
            return {"id": v["id"]}
        return self.change(actor, "admin", create)

    def save_driver(self, actor, data, driver_id=None):
        hashed = PASSWORDS.hash(data.password) if data.password is not None else None

        def save(doc, admin):
            d = find(doc, "drivers", driver_id) if driver_id else None
            u = next((u for u in doc["users"] if u.get("driverId") == driver_id), None) if d else None
            unique_email(doc, data.email, u["id"] if u else None)
            if not d and hashed is None:
                raise HTTPException(422, "Set a password of at least 10 characters for the new driver.")
            locked = d and (active_orders(doc, d["id"]) or open_reports(doc, d["id"]))
            vehicle_id = data.vehicleId if data.vehicleId is not None else (d["vehicleId"] if d else None)
            status = data.status if data.status is not None else (d["status"] if d else "Available")
            if locked and (vehicle_id != d["vehicleId"] or status != d["status"]):
                raise HTTPException(409, "Vehicle and status are locked while a delivery or report is open.")
            if not vehicle_id:
                raise HTTPException(422, "Choose an unassigned vehicle.")
            v = find(doc, "vehicles", vehicle_id)
            if any(x["vehicleId"] == vehicle_id and x["id"] != driver_id for x in doc["drivers"]):
                raise HTTPException(409, "This vehicle belongs to another driver.")
            if d and d["status"] == "Breakdown" and (vehicle_id != d["vehicleId"] or status != "Breakdown"):
                raise HTTPException(409, "Use Confirm vehicle ready after the repairs are complete.")
            if not locked and status != "Breakdown" and v["status"] != "Ready":
                raise HTTPException(409, "This vehicle is not ready for assignment.")
            old_vehicle = d["vehicleId"] if d else None
            is_new = d is None
            if is_new:
                d = {"id": uid("D")}
                u = account(data, "driver", hashed, d["id"])
                doc["users"].append(u)
                doc["drivers"].append(d)
            else:
                if hashed or u["email"] != data.email:
                    u["authVersion"] += 1  # invalidate existing driver sessions
                if hashed:
                    u["passwordHash"] = hashed
                u.update(name=data.name, email=data.email)
            d.update(name=data.name, email=data.email, phone=data.phone, distanceKm=data.distanceKm,
                     vehicleId=vehicle_id, status=status)
            if not locked:
                v["status"] = "Breakdown" if status == "Breakdown" else "Ready"
                if old_vehicle and old_vehicle != vehicle_id:
                    old = find(doc, "vehicles", old_vehicle)
                    if old["status"] != "Breakdown":
                        old["status"] = "Ready"
            log(doc, f"{admin['name']} {'added' if is_new else 'updated'} driver {d['name']}.", "users")
            return {"id": d["id"]}
        return self.change(actor, "admin", save)

    def add_order(self, actor, data):
        def create(doc, user):
            d = find(doc, "drivers", data.driverId)
            if not available(doc, d):
                raise HTTPException(409, "This driver is no longer available. Refresh and choose another driver.")
            if data.weightKg > find(doc, "vehicles", d["vehicleId"])["capacityKg"]:
                raise HTTPException(422, "The cargo exceeds the vehicle payload capacity.")
            if data.dueAt <= utcnow():
                raise HTTPException(422, "Choose a future delivery deadline.")
            o = {"id": uid("RP"), **data.model_dump(exclude={"dueAt"}),
                 "dueAt": data.dueAt.astimezone(timezone.utc).isoformat(), "status": "Assigned", "createdAt": stamp()}
            doc["orders"].append(o)
            d["status"] = "On delivery"
            find(doc, "vehicles", d["vehicleId"])["status"] = "In use"
            note(doc, d["id"], "New delivery assignment", f"{o['customer']} · {o['destination']}", orderId=o["id"])
            log(doc, f"{user['name']} assigned delivery {o['id']} to {d['name']}.", "package")
            return {"id": o["id"], "status": o["status"]}
        return self.change(actor, "admin", create)

    def submit_report(self, actor, data):
        def submit(doc, user):
            d = find(doc, "drivers", user["driverId"])
            if open_reports(doc, d["id"]):
                raise HTTPException(409, "You already have an open breakdown report.")
            if any(p.get("assignedDriverId") == d["id"] and p["status"] != "Completed" for p in doc["plans"]):
                raise HTTPException(409, "Contact admin for an active recovery breakdown. Chained recoveries are not supported in this version.")
            v = find(doc, "vehicles", d["vehicleId"])
            orders = active_orders(doc, d["id"])
            i = {"id": uid("INC"), **data.model_dump(), "driverId": d["id"], "vehicleId": v["id"],
                 "status": "Unverified", "reportedAt": stamp(), "orderIds": [o["id"] for o in orders]}
            doc["incidents"].append(i)
            d["status"] = v["status"] = "Breakdown"
            for o in orders:
                if o["status"] != "Disrupted":
                    o["pausedStatus"] = o["status"]
                o.update(status="Disrupted", incidentId=i["id"])
            note(doc, "admin", "New breakdown report", f"{d['name']} reported {data.type.lower()} at {data.location}.", incidentId=i["id"])
            log(doc, f"{d['name']} submitted breakdown report {i['id']}.", "alert")
            return {"id": i["id"], "status": i["status"], "affectedDeliveries": len(orders)}
        return self.change(actor, "driver", submit)

    def verify_report(self, actor, incident_id):
        def verify(doc, user):
            i = find(doc, "incidents", incident_id)
            if i["status"] != "Unverified":
                raise HTTPException(409, "This report has already been reviewed.")
            i.update(status="Verified", verifiedAt=stamp(), verifiedBy=user["id"])
            note(doc, i["driverId"], "Your breakdown report is verified", "Admin can now coordinate recovery.", incidentId=i["id"])
            log(doc, f"{user['name']} verified report {i['id']}.", "shield")
            return {"id": i["id"], "status": i["status"]}
        return self.change(actor, "admin", verify)

    def reject_report(self, actor, incident_id, data):
        def reject(doc, user):
            i = find(doc, "incidents", incident_id)
            if i["status"] != "Unverified":
                raise HTTPException(409, "This report has already been reviewed.")
            i.update(status="Rejected", rejectionReason=data.reason, reviewedAt=stamp(), reviewedBy=user["id"])
            note(doc, i["driverId"], "Report could not be verified", data.reason, incidentId=i["id"])
            log(doc, f"{user['name']} rejected report {i['id']}.", "file")
            # Keep the vehicle broken and the deliveries paused until repaired.
            return {"id": i["id"], "status": i["status"]}
        return self.change(actor, "admin", reject)

    def resolve_report(self, actor, incident_id):
        def resolve(doc, user):
            i = find(doc, "incidents", incident_id)
            if i["status"] != "Verified" or i["orderIds"]:
                raise HTTPException(409, "Only a verified report without affected deliveries can be closed here.")
            i.update(status="Resolved", resolvedAt=stamp())
            note(doc, i["driverId"], "Vehicle report closed", "Admin can confirm your vehicle status after repairs.", incidentId=i["id"])
            log(doc, f"{user['name']} closed report {i['id']}.")
            return {"id": i["id"], "status": i["status"]}
        return self.change(actor, "admin", resolve)

    def generate_plan(self, actor, incident_id):
        def generate(doc, user):
            i = find(doc, "incidents", incident_id)
            existing = next((p for p in doc["plans"] if p["incidentId"] == i["id"]), None)
            if existing:
                return {"id": existing["id"], "status": existing["status"]}
            if i["status"] != "Verified":
                raise HTTPException(409, "Verify the breakdown report before generating a plan.")
            orders = [find(doc, "orders", o_id) for o_id in i["orderIds"]]
            if not orders or any(o["status"] != "Disrupted" for o in orders):
                raise HTTPException(409, "There are no paused deliveries to recover. Close a vehicle-only report after review.")
            weight = round(sum(o["weightKg"] for o in orders), 4)
            options = candidates(doc, i, weight)
            if not options:
                raise HTTPException(409, f"No available driver has a ready vehicle with {weight:g} kg capacity. Update the fleet and try again.")
            orders.sort(key=lambda o: datetime.fromisoformat(o["dueAt"]))
            p = {"id": uid("PLAN"), "incidentId": i["id"], "orderIds": [o["id"] for o in orders],
                 "totalWeightKg": weight, "candidates": options, "selectedDriverId": options[0]["driverId"],
                 "status": "Draft", "createdAt": stamp(), "createdBy": user["id"]}
            doc["plans"].append(p)
            i["status"] = "Draft"
            log(doc, f"{user['name']} generated a recovery plan for {i['id']}.", "route")
            return {"id": p["id"], "status": p["status"], "candidates": len(options)}
        return self.change(actor, "admin", generate)

    def assign_plan(self, actor, plan_id, data):
        def assign(doc, user):
            p = find(doc, "plans", plan_id)
            if p["status"] != "Draft":
                raise HTTPException(409, "This plan has already been assigned.")
            i = find(doc, "incidents", p["incidentId"])
            options = candidates(doc, i, p["totalWeightKg"])
            if i["status"] != "Draft" or not any(c["driverId"] == data.driverId for c in options):
                raise HTTPException(409, "This driver is no longer available or cannot carry the load. Refresh the plan.")
            d = find(doc, "drivers", data.driverId)
            p.update(status="Assigned", assignedDriverId=d["id"], selectedDriverId=d["id"],
                     assignedAt=stamp(), approvedBy=user["id"], candidates=options)
            d["status"] = "On recovery"
            find(doc, "vehicles", d["vehicleId"])["status"] = "In use"
            i["status"] = "Assigned"
            for o_id in p["orderIds"]:
                o = find(doc, "orders", o_id)
                if o["status"] != "Disrupted" or o["driverId"] != i["driverId"]:
                    raise HTTPException(409, "The affected delivery changed. Refresh the workspace.")
                o.update(originalDriverId=i["driverId"], driverId=d["id"], recoveryPlanId=p["id"], status="Assigned")
            original = find(doc, "drivers", i["driverId"])
            note(doc, d["id"], "New recovery assignment", f"Collect {len(p['orderIds'])} deliveries ({p['totalWeightKg']:g} kg) from {original['name']} at {i['location']}.", planId=p["id"])
            note(doc, i["driverId"], "Replacement driver assigned", f"{d['name']} will collect your cargo. Follow progress in My reports.", incidentId=i["id"])
            log(doc, f"{user['name']} assigned {d['name']} to recover {i['id']}.", "truck")
            return {"id": p["id"], "status": p["status"], "driverId": d["id"]}
        return self.change(actor, "admin", assign)

    def progress_plan(self, actor, plan_id, data):
        def advance(doc, user):
            p = find(doc, "plans", plan_id)
            if p.get("assignedDriverId") != user["driverId"]:
                raise HTTPException(403, "This recovery task is not assigned to you.")
            next_status = {"Assigned": "Accepted", "Accepted": "Picked up", "Picked up": "Completed"}.get(p["status"])
            if data.status != next_status:
                raise HTTPException(409, "The task changed or this step is out of order. Refresh and try again.")
            d = find(doc, "drivers", user["driverId"])
            if d["status"] == "Breakdown" or find(doc, "vehicles", d["vehicleId"])["status"] == "Breakdown":
                raise HTTPException(409, "Your vehicle is marked as broken down. Contact admin.")
            p.update(status=data.status, updatedAt=stamp())
            i = find(doc, "incidents", p["incidentId"])
            if data.status == "Picked up":
                i["status"] = "Picked up"
                for o_id in p["orderIds"]:
                    find(doc, "orders", o_id)["status"] = "In transit"
            if data.status == "Completed":
                i.update(status="Resolved", resolvedAt=stamp())
                p["completedAt"] = stamp()
                for o_id in p["orderIds"]:
                    find(doc, "orders", o_id).update(status="Delivered", deliveredAt=stamp())
                release(doc, d["id"])
                note(doc, i["driverId"], "Recovery completed", f"{d['name']} completed all deliveries from {i['id']}.", incidentId=i["id"])
            note(doc, "admin", f"Recovery {data.status.lower()}", f"{d['name']} updated {p['id']} to {data.status}.", incidentId=i["id"])
            log(doc, f"{d['name']} updated recovery {p['id']} to {data.status}.")
            return {"id": p["id"], "status": p["status"]}
        return self.change(actor, "driver", advance)

    def progress_order(self, actor, order_id, data):
        def advance(doc, user):
            o = find(doc, "orders", order_id)
            if o["driverId"] != user["driverId"]:
                raise HTTPException(403, "This delivery is not assigned to you.")
            if o.get("recoveryPlanId"):
                raise HTTPException(409, "Update a recovery delivery through its recovery task.")
            if {"Assigned": "In transit", "In transit": "Delivered"}.get(o["status"]) != data.status:
                raise HTTPException(409, "This delivery changed or is paused. Refresh and try again.")
            d = find(doc, "drivers", user["driverId"])
            if d["status"] == "Breakdown":
                raise HTTPException(409, "Your deliveries are paused for a breakdown.")
            o.update(status=data.status, updatedAt=stamp())
            if data.status == "Delivered":
                o["deliveredAt"] = stamp()
            release(doc, d["id"])
            note(doc, "admin", "Delivery status updated", f"{d['name']} updated {o['id']} to {data.status}.", orderId=o["id"])
            log(doc, f"{d['name']} updated delivery {o['id']} to {data.status}.", "package")
            return {"id": o["id"], "status": o["status"]}
        return self.change(actor, "driver", advance)

    def vehicle_ready(self, actor, driver_id):
        def confirm(doc, user):
            d = find(doc, "drivers", driver_id)
            if d["status"] != "Breakdown" or open_reports(doc, driver_id):
                raise HTTPException(409, "Review and resolve the open report before confirming the vehicle is ready.")
            for o in active_orders(doc, driver_id):
                if o["status"] == "Disrupted":
                    o["status"] = o.pop("pausedStatus", "Assigned")
            busy = bool(active_orders(doc, driver_id))
            d["status"] = "On delivery" if busy else "Available"
            find(doc, "vehicles", d["vehicleId"])["status"] = "In use" if busy else "Ready"
            note(doc, d["id"], "Vehicle ready", "Your deliveries have resumed." if busy else "You are available for new work.")
            log(doc, f"{user['name']} confirmed {d['name']}'s vehicle is ready.", "wrench")
            return {"id": d["id"], "status": d["status"]}
        return self.change(actor, "admin", confirm)

    def save_stock(self, actor, data, stock_id=None):
        def save(doc, user):
            item = find(doc, "stock", stock_id) if stock_id else {"id": uid("S")}
            item.update(data.model_dump())
            if not stock_id:
                doc["stock"].append(item)
            log(doc, f"{user['name']} updated {item['name']} stock to {item['quantity']} {item['unit']}.", "warehouse")
            return {"id": item["id"], "quantity": item["quantity"]}
        return self.change(actor, "admin", save)

    def location(self, actor, data):
        def update(doc, user):
            d = find(doc, "drivers", user["driverId"])
            d.update(location=data.location, locationUpdatedAt=stamp())
            log(doc, f"{d['name']} updated their location to {data.location}.", "pin")
            return {"id": d["id"], "location": d["location"]}
        return self.change(actor, "driver", update)

    def read_notifications(self, actor):
        def mark(doc, user):
            target = "admin" if user["role"] == "admin" else user["driverId"]
            for n in doc["notifications"]:
                if n["target"] == target:
                    n["read"] = True
            return {"ok": True}
        return self.change(actor, None, mark)

