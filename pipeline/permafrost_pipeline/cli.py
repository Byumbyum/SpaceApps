from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

from .products import inspect_nisar_gunw, inspect_opera_disp


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Dalton corridor offline data pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate = subparsers.add_parser("generate-demo", help="Create deterministic synthetic web layers")
    generate.add_argument("--output", default="public/data", help="Output directory relative to repository root")

    inspect = subparsers.add_parser("inspect", help="Inspect local source-product provenance before processing")
    inspect.add_argument("kind", choices=("nisar-gunw", "opera-disp"))
    inspect.add_argument("paths", nargs="+")
    inspect.add_argument("--output", help="Optional JSON inventory path")
    return parser


def main() -> int:
    args = _parser().parse_args()
    if args.command == "generate-demo":
        repository = Path(__file__).resolve().parents[2]
        command = [sys.executable, str(repository / "demo" / "generate_demo.py"), "--output", args.output]
        return subprocess.call(command, cwd=repository)

    reader = inspect_nisar_gunw if args.kind == "nisar-gunw" else inspect_opera_disp
    inventory = [asdict(reader(path)) for path in args.paths]
    payload = json.dumps(inventory, indent=2)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
