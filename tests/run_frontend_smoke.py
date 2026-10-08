"""Start an isolated test API, run Node DOM checks, then stop it.

Run with the project virtualenv after npm install and requirements-dev.txt.
"""
from pathlib import Path
import shutil
import socket
import subprocess
import sys
from threading import Thread
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import mongomock
import uvicorn
from backend.app.config import Settings
from backend.app.main import create_app


def main():
    if not shutil.which("node"):
        raise SystemExit("Install Node.js and run npm install before this optional test.")
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen(128)
    port = sock.getsockname()[1]
    app = create_app(Settings(database="rescueplan_frontend_test"), mongomock.MongoClient(tz_aware=True))
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error"))
    thread = Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started and thread.is_alive() and time.monotonic() < deadline:
        time.sleep(0.05)
    if not server.started:
        raise SystemExit("The isolated test API did not start.")
    try:
        result = subprocess.run(["node", str(ROOT / "tests/frontend_smoke.cjs"), f"http://127.0.0.1:{port}"], cwd=ROOT, timeout=90)
        return result.returncode
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        sock.close()


if __name__ == "__main__":
    raise SystemExit(main())

