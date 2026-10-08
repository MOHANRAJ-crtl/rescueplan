"""MongoDB persistence and atomic workspace updates for this small MVP.

One workspace document keeps related report/order/driver changes atomic on a
standalone MongoDB server as well as Atlas. A revision comparison prevents lost
updates across requests, processes and admins. Sessions live in a TTL collection.
"""
from copy import deepcopy

from bson import BSON
from fastapi import HTTPException
from pymongo import MongoClient

from .config import Settings

PUBLIC_ARRAYS = ("drivers", "vehicles", "orders", "incidents", "plans", "stock", "notifications", "activity")


def empty_workspace():
    return {"_id": "operations", "revision": 0, "version": 1, "users": [],
            **{key: [] for key in PUBLIC_ARRAYS}}


class Store:
    def __init__(self, settings: Settings, client=None):
        self.owns_client = client is None
        self.client = client if client is not None else MongoClient(
            settings.mongodb_uri, serverSelectionTimeoutMS=5000, tz_aware=True)
        self.db = self.client[settings.database]
        self.workspace = self.db["workspaces"]
        self.sessions = self.db["sessions"]

    def initialize(self):
        self.client.admin.command("ping")
        self.sessions.create_index("expiresAt", expireAfterSeconds=0)
        self.workspace.update_one({"_id": "operations"}, {"$setOnInsert": empty_workspace()}, upsert=True)

    def close(self):
        if self.owns_client:
            self.client.close()

    def read(self):
        doc = self.workspace.find_one({"_id": "operations"})
        if doc is None:
            raise HTTPException(503, "The workspace is not initialized. Restart the server.")
        return doc

    def mutate(self, callback):
        for _ in range(12):
            doc = self.read()
            revision = doc["revision"]
            result = callback(doc)
            doc["revision"] = revision + 1
            if len(BSON.encode(doc)) > 14 * 1024 * 1024:
                raise HTTPException(413, "This MVP workspace is full. Archive historical records before adding more.")
            write = self.workspace.replace_one({"_id": "operations", "revision": revision}, doc)
            if write.modified_count == 1:
                return deepcopy(result)
        raise HTTPException(409, "The workspace changed repeatedly. Refresh and try again.")

