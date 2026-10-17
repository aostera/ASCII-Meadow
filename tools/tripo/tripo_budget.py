#!/usr/bin/env python3
"""Cost-capped Tripo gateway for ASCII Meadow / The Ashen Vow.

Two free commands: 'balance', 'prepare'.
ONE paid command: 'generate' (never run by default; 20-credit preauth).
No retry of paid POST, no texture, rig, low-poly, quad, parts, export conversion.

https://platform.tripo3d.ai/docs/billing
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.tripo3d.ai/v2/openapi"
APPROVAL = "TRIPO_APPROVE_ONCE_20_CREDITS"
COST = 20
VERSION = "v3.1-20260211"
SOURCE_URL = (
    "https://d2ol7oe51mr4n9.cloudfront.net/"
    "user_3DREk3h2KN9SwfHIFei2XoVxjD4/"
    "537d1a97-9ad5-4920-96dd-d465e2a7968c.jpg"
)
OUT = pathlib.Path(os.environ.get("TRIPO_OUT_DIR", "artifacts/tripo-ashen-vow"))

def request_json(path: str, *, data: dict | None = None, token: str | None = None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if data is None:
        req = urllib.request.Request(API + path, headers=headers, method="GET")
    else:
        headers["Content-Type"] = "application/json"
        req = urllib.request.Request(
            API + path, data=json.dumps(data).encode("utf-8"), headers=headers,
            method="POST"
        )
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            body = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError("Tripo HTTP " + str(exc.code) +
                           ". Check action logs / account; no automatic retry.") from exc
    if body.get("code") != 0:
        raise RuntimeError("Tripo returned API error: " +
                           str(body.get("code")) + " " + str(body.get("message")))
    return body.get("data", {})

def key():
    value = os.environ.get("TRIPO_API_KEY", "")
    if not value.startswith("tsk_"):
        raise RuntimeError("TRIPO_API_KEY is missing or does not start with tsk_.")
    return value

def balance(token):
    # GET does NOT create a paid generation task.
    data = request_json("/user/balance", token=token)
    available, frozen = data["balance"], data.get("frozen", 0)
    print("Tripo API credits: available=" + str(available) +
          ", frozen=" + str(frozen) + " (read-only check)", flush=True)
    return available

def download_source():
    OUT.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "ASCII-Meadow/1.0"})
    with urllib.request.urlopen(req, timeout=50) as response:
        content = response.read(9_000_000)
    if content[:3] != b"\xff\xd8\xff" or len(content) > 8_000_000:
        raise RuntimeError("Source reference is missing or invalid; STOP before spending.")
    (OUT / "original-reference.jpg").write_bytes(content)
    return OUT / "original-reference.jpg"

def prepare():
    """Crop real user-approved FRONT / SIDE / BACK; mirror last SIDE free."""
    from PIL import Image, ImageOps
    src = Image.open(download_source()).convert("RGB")
    if src.width < 900 or src.height < 650:
        raise RuntimeError("Unexpected reference resolution. STOP before spending.")
    # The user's approved THE ASHEN VOW board, normalized to 1448×1086.
    src = src.resize((1448, 1086), Image.Resampling.LANCZOS)
    boxes = {
        "front": (619, 52, 901, 598),
        "right": (914, 62, 1127, 599),
        "back": (1162, 62, 1433, 593),
    }
    for name, rect in boxes.items():
        crop = src.crop(rect)
        # Remove the title and view labels; put character at the same floor level.
        crop.thumbnail((400, 685), Image.Resampling.LANCZOS)
        bg = Image.new("RGB", (512, 768), (27, 26, 28))
        bg.paste(crop, ((512 - crop.width) // 2, 26 + (686 - crop.height)))
        if name == "right":
            # Source concept has one lateral angle; its opposite is approximated
            # free by a mirror. This does NOT invent a separate expensive view.
            bg_mirror = ImageOps.mirror(bg)
            bg_mirror.save(OUT / "left.jpg", quality=91, optimize=True)
        bg.save(OUT / (name + ".jpg"), quality=91, optimize=True)
    print("Prepared FOUR orthographic references locally, zero Tripo credits.", flush=True)
    return [OUT / (x + ".jpg") for x in ("front", "left", "back", "right")]

def upload_image(path: pathlib.Path, token):
    """Upload is NOT a model-generation task. No credits expected."""
    import uuid
    boundary = "----ASCII-Meadow-" + uuid.uuid4().hex
    jpg = path.read_bytes()
    body = (("--" + boundary + "\r\n"
             'Content-Disposition: form-data; name="file"; filename="' +
             path.name + '"\r\nContent-Type: image/jpeg\r\n\r\n').encode() +
            jpg + ("\r\n--" + boundary + "--\r\n").encode())
    req = urllib.request.Request(
        API + "/upload/sts", data=body, method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "multipart/form-data; boundary=" + boundary,
            "Accept": "application/json",
        })
    with urllib.request.urlopen(req, timeout=60) as response:
        obj = json.load(response)
    if obj.get("code") != 0 or not obj.get("data", {}).get("image_token"):
        raise RuntimeError("Reference upload failed; no paid 3D task launched.")
    return {"type": "jpg", "file_token": obj["data"]["image_token"]}

def authorized():
    """Three non-bypassable guards before the single billable POST."""
    request_path = pathlib.Path("tools/tripo/approved-request.json")
    if not request_path.exists():
        raise RuntimeError("No explicit user-approved request file. Zero spend.")
    a = json.loads(request_path.read_text(encoding="utf-8"))
    if (a.get("authorization") != APPROVAL or
            a.get("max_total_credits") != COST or
            a.get("count") != 1 or
            a.get("model") != VERSION):
        raise RuntimeError("Approval file must authorize exactly one 20-credit H3.1 job.")
    if os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("Paid operation is CI-only.")
    if os.environ.get("GITHUB_REF") != "refs/heads/feat/tripo-ashen-budget-gated":
        raise RuntimeError("Paid operation is restricted to protected feature branch.")
    if os.environ.get("GITHUB_RUN_ATTEMPT") != "1":
        raise RuntimeError("GitHub Actions rerun would spend credits again; REFUSED.")
    event_path = os.environ.get("GITHUB_EVENT_PATH", "")
    if not event_path:
        raise RuntimeError("No signed GitHub run event.")
    event = json.loads(pathlib.Path(event_path).read_text(encoding="utf-8"))
    if event.get("head_commit", {}).get("message") != APPROVAL:
        raise RuntimeError("Approval commit missing. Zero spend.")
    return a

def fetch_finished(task_id: str, token):
    # Only read-only GET polling; no paid retries.
    for iteration in range(120):
        data = request_json("/task/" + urllib.parse.quote(task_id), token=token)
        status = data.get("status")
        print("Tripo task state: " + str(status) +
              ", credits consumed: " + str(data.get("consumed_credit", "?")), flush=True)
        if status == "success":
            (OUT / "result.json").write_text(json.dumps({
                "task_id": task_id,
                "status": status,
                "consumed_credit": data.get("consumed_credit"),
            }, indent=2), encoding="utf-8")
            result = data.get("output", {})
            model_url = result.get("base_model") or result.get("model")
            if not isinstance(model_url, str) or not model_url.startswith("https://"):
                raise RuntimeError("No downloadable original base model in successful result.")
            # Signed URLs expire quickly: download IMMEDIATELY, no external conversion.
            with urllib.request.urlopen(model_url, timeout=80) as response:
                raw = response.read(150_000_000)
            if raw[:4] == b"glTF":
                output = OUT / "The_Ashen_Vow_Tripo_H3_1_Base.glb"
            elif raw[:2] == b"PK":
                output = OUT / "The_Ashen_Vow_Tripo_H3_1_Base.zip"
            else:
                raise RuntimeError("Unexpected 3D file format. No further paid calls.")
            output.write_bytes(raw)
            print("Saved original generated asset:", output, len(raw), "bytes", flush=True)
            return
        if status in ("failed", "cancelled", "banned", "expired"):
            raise RuntimeError("Tripo task terminal state: " + str(status) +
                               ". Paid call will NOT be retried.")
        time.sleep(10)
    raise RuntimeError("Timed out on read-only polling. Task ID remains in log; do NOT rerun.")

def generate():
    authorized()
    token = key()
    available = balance(token)
    if available < COST:
        raise RuntimeError("Available balance below hard cap 20. No task submitted.")
    paths = prepare()
    files = [upload_image(p, token) for p in paths]
    payload = {
        "type": "multiview_to_model",
        "model_version": VERSION,
        "texture": False,
        "pbr": False,
        "geometry_quality": "standard",
        "quad": False,
        "orthographic_projection": True,
        # Required ordering by Tripo API: FRONT, LEFT, BACK, RIGHT.
        # No paid add-ons and no unsupported image-to-model arguments.
        "files": files,
    }
    assert payload["texture"] is False and payload["pbr"] is False
    print("SUBMITTING ONE PAID Tripo H3.1 multi-view geometry job."
          " Hard budget: 20 credits. No retries or paid post-processing.", flush=True)
    # Single POST: NEVER retry after a timeout; could already have been billed.
    task = request_json("/task", data=payload, token=token)
    task_id = task.get("task_id")
    if not task_id:
        raise RuntimeError("No returned task ID. NEVER retry automatically.")
    print("TRIPO_TASK_ID=" + task_id, flush=True)
    fetch_finished(task_id, token)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["balance", "prepare", "generate"])
    args = parser.parse_args()
    if args.command == "balance":
        balance(key())
    elif args.command == "prepare":
        prepare()
    else:
        generate()

if __name__ == "__main__":
    main()
