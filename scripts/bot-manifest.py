"""Writes lib/bot-manifest.json: a short hash of every bot code file, from the latest copies of the bots.

    python3 scripts/bot-manifest.py /path/to/development

Admin → Bots → Up to date? compares these with what each running bot reports (events/fingerprint.py), so it can
list the files that still need uploading. Same rules as the bots: .py files plus *_default.json / *_catalog.json,
line endings ignored. Re-run it whenever bot files change.
"""

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BOTS = {"main": "Main_Bot", "economy": "Economy", "moderation": "Moderation", "ticketing": "TIcketing"}
SKIP_DIRS = {"__pycache__", "transcripts", ".git", "venv", ".venv", "node_modules"}


def code_files(root: Path):
    for path in sorted(root.rglob("*")):
        if not path.is_file() or any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        if path.suffix == ".py" or (path.suffix == ".json" and (path.name.endswith("_default.json") or path.name.endswith("_catalog.json"))):
            yield path


def main():
    base = Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser()
    out = {"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "bots": {}}
    for key, folder in BOTS.items():
        root = base / folder
        if not root.is_dir():
            print(f"skipping {key}: {root} not found")
            continue
        files = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:16] for p in code_files(root)}
        out["bots"][key] = files
        print(f"{key}: {len(files)} files")
    target = Path(__file__).resolve().parents[1] / "lib" / "bot-manifest.json"
    target.write_text(json.dumps(out, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
