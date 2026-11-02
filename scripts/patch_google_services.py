#!/usr/bin/env python3
"""Keep android/app/google-services.json in sync with the edition applicationId.

The Android build produces several editions with different applicationIds
(com.infinite.chat, com.infinite.chat.m2, com.infinite.chat.classic), but the
Google Services Gradle plugin (``processDebugGoogleServices``) fails when the
applicationId has no matching client inside google-services.json:

    No matching client found for package name 'com.infinite.chat.m2'

This script rewrites the ``package_name`` of every client to the requested
edition package so that each edition can be assembled. Everything else in the
file (project id, api keys, app ids) is preserved.

Usage:
    python3 scripts/patch_google_services.py com.infinite.chat.m2
"""
from __future__ import annotations

import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
GOOGLE_SERVICES = REPO_ROOT / "android" / "app" / "google-services.json"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: patch_google_services.py <applicationId>", file=sys.stderr)
        return 2

    package_name = argv[1]

    if not GOOGLE_SERVICES.exists():
        print(f"{GOOGLE_SERVICES} not found - skipping (push notifications disabled)")
        return 0

    data = json.loads(GOOGLE_SERVICES.read_text(encoding="utf-8"))
    clients = data.get("client") or []
    if not clients:
        print("google-services.json has no clients - skipping")
        return 0

    for client in clients:
        client_info = client.setdefault("client_info", {})
        client_info.setdefault("android_client_info", {})["package_name"] = package_name

    GOOGLE_SERVICES.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"google-services.json: package_name set to {package_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
