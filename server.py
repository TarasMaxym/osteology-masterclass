#!/usr/bin/env python3
"""
Standalone local server for JUMC Osteology & Pins Masterclass.
Serves static/ assets and persists mastery, timing & weak-spot data atomically to user_progress.json.
Zero external dependencies (Python 3 standard library only).
"""

import argparse
import json
import os
import sys
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = HERE
PROGRESS_PATH = os.path.join(HERE, "user_progress.json")
BACKUP_DIR = os.path.join(HERE, "backups")


def default_progress():
    return {
        "version": 1,
        "createdAt": int(time.time() * 1000),
        "updatedAt": int(time.time() * 1000),
        "pins": {},          # pinId -> { attempts, correct, streak, mastery, avgMs, lastMs, lastSeen, typos, orientationTraps, confusions }
        "reversePins": {},   # pinId -> { attempts, hits, bestDist, lastSeen }
        "gapDrills": {},     # drillId -> { attempts, correct, mastery, lastSeen }
        "occlusion": {},     # occId -> { attempts, correct, mastery, lastSeen }
        "boneId": {},        # itemId -> { attempts, correct, streak, mastery, avgMs, lastMs, lastSeen }
        "examHistory": [],   # [{ ts, mode, score, total, avgMs, missedIds }]
        "dailyStats": {},    # YYYY-MM-DD -> { reviews, correct, totalMs }
        "bookmarks": [],     # list of flagged pinIds
        "settings": {
            "spotlight": True,
            "autoZoom": False,
            "blindBone": True,
            "timerSeconds": 30,
            "showInlineHooks": True,
        },
    }


def load_progress():
    if not os.path.isfile(PROGRESS_PATH):
        return default_progress()
    try:
        with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        base = default_progress()
        base.update(data)
        return base
    except Exception:
        return default_progress()


def save_progress(data):
    data["updatedAt"] = int(time.time() * 1000)
    tmp_path = PROGRESS_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, PROGRESS_PATH)


class MasterclassHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def log_message(self, fmt, *args):
        # Quiet normal media requests to keep terminal clean
        if len(args) >= 1 and isinstance(args[0], str) and "/media/" in args[0]:
            return
        super().log_message(fmt, *args)

    def end_headers(self):
        if self.path.startswith("/media/"):
            self.send_header("Cache-Control", "public, max-age=86400")
        elif self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send_json(self, payload, status=HTTPStatus.OK):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/progress":
            self._send_json(load_progress())
            return
        if self.path.split("?")[0] == "/api/health":
            self._send_json({"ok": True, "ts": int(time.time() * 1000)})
            return
        return super().do_GET()

    def do_POST(self):
        route = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length > 0 else b"{}"

        if route == "/api/progress":
            try:
                incoming = json.loads(body.decode("utf-8"))
                if not isinstance(incoming, dict):
                    raise ValueError("Payload must be a JSON object")
                save_progress(incoming)
                self._send_json({"ok": True, "updatedAt": incoming["updatedAt"]})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, status=HTTPStatus.BAD_REQUEST)
            return

        if route == "/api/reset":
            # Save safety backup before resetting
            if os.path.isfile(PROGRESS_PATH):
                os.makedirs(BACKUP_DIR, exist_ok=True)
                bname = f"progress_backup_{int(time.time())}.json"
                with open(PROGRESS_PATH, "rb") as src, open(os.path.join(BACKUP_DIR, bname), "wb") as dst:
                    dst.write(src.read())
            fresh = default_progress()
            save_progress(fresh)
            self._send_json({"ok": True, "state": fresh})
            return

        self._send_json({"ok": False, "error": "Not found"}, status=HTTPStatus.NOT_FOUND)


def main():
    parser = argparse.ArgumentParser(description="Run JUMC Osteology Masterclass Server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    httpd = ThreadingHTTPServer((args.host, args.port), MasterclassHandler)
    print(f"JUMC Osteology & Pins Masterclass running at http://{args.host}:{args.port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        httpd.server_close()


if __name__ == "__main__":
    main()
