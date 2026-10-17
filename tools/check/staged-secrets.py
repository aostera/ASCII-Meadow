#!/usr/bin/env python3
"""Local pre-commit prevention: inspect the *staged* versions, before any push.

Never prints secret material, and runs without a network or third-party packages.
Enable on each clone with: sh tools/security/install-hooks.sh
"""
import importlib.util
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
corefile = ROOT / "tools/check/secret-history.py"
spec = importlib.util.spec_from_file_location("ascii_meadow_history_secrets", corefile)
patterns = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patterns)


def git_bytes(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, stderr=subprocess.DEVNULL)


def main():
    try:
        names = [p.decode("utf-8", "surrogateescape") for p in
                 git_bytes("diff", "--cached", "--name-only", "--diff-filter=ACMRT", "-z").split(b"\x00") if p]
    except (OSError, subprocess.CalledProcessError):
        print("BLOCKED COMMIT: unable to inspect staged files (fail closed).")
        return 2

    results = []
    for path in names:
        if patterns.SENSITIVE_PATH.search(path) and not patterns.EXAMPLE.search(path):
            results.append(("sensitive filename", path))
        try:
            payload = git_bytes("show", ":" + path)
        except (OSError, subprocess.CalledProcessError):
            results.append(("unreadable staged file", path))
            continue
        if len(payload) > patterns.LIMIT:
            results.append(("oversized staged file", path))
            continue
        if b"\x00" in payload[:8192]:
            continue  # Images/other binary assets are handled by repository asset checks.
        sample = payload[:8192]
        if sample and sum(c < 9 or 13 < c < 32 for c in sample) > len(sample) * .04:
            continue
        text = payload.decode("utf-8", "replace")
        for title, rx in patterns.RX:
            if rx.search(text):
                results.append((title, path))
        for match in patterns.ASSIGN.finditer(text):
            value = match.group(1).strip(".")
            if (len(value) >= 10 and not patterns.FAKE.match(value)
                    and not value.isnumeric()
                    and not (value.isalpha() and len(set(value.lower())) < 6)):
                results.append(("possible hardcoded credential", path))
                break

    if results:
        print("BLOCKED COMMIT: potential credentials or sensitive staged paths.")
        for title, path in sorted(set(results)):
            # In the local terminal, names are helpful, but token values are always hidden.
            print(" -", title, "in", path if not __import__("os").getenv("CI") else "[redacted]")
        print("Remove staged secrets, rotate any exposed credentials, then retry.")
        return 2
    print(f"PASS staged secret scan: {len(names)} changed files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
