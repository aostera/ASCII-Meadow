#!/usr/bin/env python3
"""Read-only audit of all reachable Git objects. Never prints credential values.

Use after fetching all remote branches and pull-request heads.
Heuristic checks: also enable GitHub secret scanning and rotate any exposed keys.
"""
import re
import subprocess
import sys

LIMIT = 6 * 1024 * 1024
RX = [
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,})\b")),
    ("openai-token", re.compile(r"\b(?:sk-proj-|sk-svcacct-|sk-admin-)[A-Za-z0-9_-]{25,}\b|\bsk-[A-Za-z0-9]{32,}\b|\bsk-ant-[A-Za-z0-9_-]{25,}\b")),
    ("aws-key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("google-api-key", re.compile(r"\bAIza[A-Za-z0-9_-]{35}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{15,}\b")),
    ("npm-token", re.compile(r"\bnpm_[A-Za-z0-9]{30,}\b")),
    ("gitlab-token", re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b")),
    ("stripe-live-key", re.compile(r"\b(?:sk_live_|rk_live_)[A-Za-z0-9]{20,}\b")),
    ("sendgrid-key", re.compile(r"\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b")),
    ("telegram-token", re.compile(r"\b[0-9]{8,12}:AA[A-Za-z0-9_-]{30,}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{10,}\b")),
    ("basic-auth-url", re.compile(r"https?://[^/\s:@]+:[^/\s@]{4,}@", re.I)),
    ("bearer-header", re.compile(r"\bAuthorization\s*[:=]\s*['\"]?Bearer\s+[A-Za-z0-9._~-]{20,}", re.I)),
    ("secret-url-parameter", re.compile(r"[?&](?:access_token|api_key|secret|client_secret|auth_token)=([A-Za-z0-9_%-]{20,})", re.I)),
]
ASSIGN = re.compile(
    r"""(?<![A-Za-z0-9_])(?:api[_-]?key|secret[_-]?key|secret[_-]?access[_-]?key|
    auth[_-]?token|access[_-]?token|refresh[_-]?token|cloudflare[_-]?api[_-]?token|
    password|client[_-]?secret|private[_-]?key|github[_-]?token|
    openai[_-]?api[_-]?key|database[_-]?url)\b['"]?\s*[:=]\s*['"]?
    ([A-Za-z0-9_./+=:-]{10,})""", re.I | re.X,
)
FAKE = re.compile(
    r"^(?:example|placeholder|your|dummy|sample|replace|changeme|undefined|"
    r"null|none|false|true|process\.|import\.|os\.|env\.|getenv|secrets\.|"
    r"vars\.|testtoken|testpassword|redacted|https?://(?:localhost|example))", re.I,
)
SENSITIVE_PATH = re.compile(
    r"(^|/)(?:\.env(?:\..+)?|\.dev\.vars(?:\..+)?|\.npmrc|\.pypirc|"
    r"id_rsa|id_ed25519|credentials(?:\.[^/]*)?|service[-_]?account[^/]*"
    r"|[^/]*\.(?:pem|p12|pfx|key|tfstate))$", re.I,
)
EXAMPLE = re.compile(r"(?:^|/)(?:\.env|\.dev\.vars)\.(?:example|sample|template)$", re.I)


def safe_path(name):
    return "/".join("[long-name]" if len(p) > 110 else p for p in
                    re.sub(r"[\x00-\x1f\x7f]", "?", name).split("/"))[:220]


def read_git_history():
    rows = subprocess.check_output(["git", "rev-list", "--objects", "--all"],
                                   stderr=subprocess.DEVNULL).decode("utf-8", "replace").splitlines()
    objs = {}
    for row in rows:
        oid, _, path = row.partition(" ")
        if oid not in objs or (path and not objs[oid]):
            objs[oid] = path
    return objs


def main():
    try:
        objs = read_git_history()
    except (OSError, subprocess.CalledProcessError):
        print("ERROR: cannot read repository history")
        return 3

    findings = set()
    for sha, name in objs.items():
        if name and SENSITIVE_PATH.search(name) and not EXAMPLE.search(name):
            findings.add(("sensitive-file-in-history", safe_path(name), 0, sha[:12]))

    proc = subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    checked = commits = binary = oversized = 0
    try:
        for oid, name in objs.items():
            proc.stdin.write((oid + "\n").encode("ascii"))
            proc.stdin.flush()
            head = proc.stdout.readline().decode("ascii", "replace").strip().split()
            if len(head) != 3 or head[1] not in ("blob", "commit", "tree", "tag"):
                raise RuntimeError("Unexpected Git object header")
            kind, size = head[1], int(head[2])
            commits += kind == "commit"
            if size > LIMIT:
                remaining = size
                while remaining:
                    block = proc.stdout.read(min(65536, remaining))
                    if not block:
                        raise RuntimeError("Truncated Git object")
                    remaining -= len(block)
                proc.stdout.read(1)
                oversized += 1
                continue
            payload = proc.stdout.read(size)
            if len(payload) != size or proc.stdout.read(1) != b"\n":
                raise RuntimeError("Truncated Git object")
            if kind == "tree":
                continue
            if b"\x00" in payload[:8192]:
                binary += 1
                continue
            sample = payload[:8192]
            if sample and sum(c < 9 or 13 < c < 32 for c in sample) > len(sample) * .04:
                binary += 1
                continue
            text = payload.decode("utf-8", "replace")
            checked += 1
            filename = safe_path(name) if name else f"[{kind} object]"
            for title, rx in RX:
                for match in rx.finditer(text):
                    findings.add((title, filename, text.count("\n", 0, match.start()) + 1, oid[:12]))
            for match in ASSIGN.finditer(text):
                value = match.group(1).strip(".")
                if len(value) >= 10 and not FAKE.match(value):
                    if not value.isnumeric() and not (value.isalpha() and len(set(value.lower())) < 6):
                        findings.add(("possible-secret-assignment", filename,
                                      text.count("\n", 0, match.start()) + 1, oid[:12]))
    except (OSError, RuntimeError, ValueError) as e:
        print("ERROR:", type(e).__name__, "while scanning history")
        return 3
    finally:
        proc.stdin.close()
        proc.stdout.close()
        proc.wait(timeout=10)

    print(f"Reachable objects: {len(objs)}; inspected text/commits/tags: {checked}; "
          f"commits: {commits}; binary: {binary}; oversized: {oversized}.")
    if not findings:
        print("No detections using configured patterns. Not a guarantee against all leaks.")
        return 0
    for category, path, lineno, sha in sorted(findings)[:80]:
        loc = f":{lineno}" if lineno else ""
        print(f"FINDING: {category} {path}{loc} (object {sha})")
    if len(findings) > 80:
        print(f"Additional findings not shown: {len(findings) - 80}")
    print(f"Total findings: {len(findings)}. Secret VALUES are intentionally never displayed.")
    return 2


if __name__ == "__main__":
    sys.exit(main())
