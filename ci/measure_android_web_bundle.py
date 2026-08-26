#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from pathlib import Path

DIST = Path("dist")
INDEX = DIST / "index.html"
BOOTSTRAP_LIMIT_BYTES = 100 * 1024
LARGEST_JS_LIMIT_BYTES = 900 * 1024
TOTAL_JS_LIMIT_BYTES = 8_500_000

if not INDEX.is_file():
    raise SystemExit("dist/index.html missing")

html = INDEX.read_text(encoding="utf-8")
script_sources = re.findall(r'<script[^>]+src=["\']([^"\']+\.js)["\']', html, flags=re.IGNORECASE)
if not script_sources:
    raise SystemExit("No JavaScript entry script found in dist/index.html")

bootstrap_files: list[Path] = []
for source in script_sources:
    relative = source.split("?", 1)[0].lstrip("./")
    path = DIST / relative
    if not path.is_file():
        raise SystemExit(f"Bootstrap script missing: {path}")
    bootstrap_files.append(path)

js_files = sorted(DIST.rglob("*.js"))
all_files = [path for path in DIST.rglob("*") if path.is_file()]
if not js_files:
    raise SystemExit("No JavaScript files found in dist")

bootstrap_bytes = sum(path.stat().st_size for path in bootstrap_files)
largest_js = max(js_files, key=lambda path: path.stat().st_size)
largest_js_bytes = largest_js.stat().st_size
total_js_bytes = sum(path.stat().st_size for path in js_files)
total_web_bytes = sum(path.stat().st_size for path in all_files)

print(f"bootstrap_js_bytes={bootstrap_bytes}")
print(f"largest_js_chunk={largest_js.relative_to(DIST)}")
print(f"largest_js_chunk_bytes={largest_js_bytes}")
print(f"total_js_bytes={total_js_bytes}")
print(f"total_web_bytes={total_web_bytes}")
print(f"bootstrap_js_budget_bytes={BOOTSTRAP_LIMIT_BYTES}")
print(f"largest_js_budget_bytes={LARGEST_JS_LIMIT_BYTES}")
print(f"total_js_budget_bytes={TOTAL_JS_LIMIT_BYTES}")

if bootstrap_bytes > BOOTSTRAP_LIMIT_BYTES:
    raise SystemExit(
        f"Bootstrap JavaScript budget exceeded: {bootstrap_bytes} > {BOOTSTRAP_LIMIT_BYTES} bytes"
    )
if largest_js_bytes > LARGEST_JS_LIMIT_BYTES:
    raise SystemExit(
        f"Largest JavaScript chunk budget exceeded: {largest_js_bytes} > {LARGEST_JS_LIMIT_BYTES} bytes ({largest_js.relative_to(DIST)})"
    )
if total_js_bytes > TOTAL_JS_LIMIT_BYTES:
    raise SystemExit(
        f"Total JavaScript budget exceeded: {total_js_bytes} > {TOTAL_JS_LIMIT_BYTES} bytes"
    )

env_path = os.environ.get("GITHUB_ENV")
if env_path:
    with open(env_path, "a", encoding="utf-8") as handle:
        handle.write(f"BOOTSTRAP_JS_BYTES={bootstrap_bytes}\n")
        handle.write(f"LARGEST_JS_CHUNK_BYTES={largest_js_bytes}\n")
        handle.write(f"TOTAL_JS_BYTES={total_js_bytes}\n")
        handle.write(f"TOTAL_WEB_BYTES={total_web_bytes}\n")
