#!/usr/bin/env python3
"""Archive only the authorized immutable c1 evidence, never the candidate.

Every destination is created exclusively. This script deliberately is not an
overwrite/synchronization tool. Supply a new empty destination for a replay.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def digest(path):
    data = path.read_bytes()
    return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def inventory(directory, excluded=()):
    result = []
    for path in sorted(directory.rglob("*")):
        if path.is_symlink():
            raise RuntimeError(f"Symlink in authorized evidence: {path}")
        if path.is_file() and path.relative_to(directory).as_posix() not in excluded:
            result.append(path.relative_to(directory).as_posix())
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    destination = args.destination.resolve()
    script = Path(__file__).resolve(strict=True)
    if source == destination or source in destination.parents:
        raise RuntimeError("Archive destination must be outside the source run")

    mappings = []
    inventories_before = {}
    for group in ("core", "closure", "build-boundary"):
        excludes = ("README.md",) if group == "build-boundary" else ()
        paths = inventory(source / group, excludes)
        inventories_before[group] = paths
        mappings.extend((f"{group}/{path}", f"{group}/{path}") for path in paths)
    # Preserve the original closure paths and provide the requested dependency
    # category. These two small aliases are exact copies, not rewritten reports.
    mappings.extend([
        ("closure/installed-dependencies.json", "installed-dependencies/installed-dependencies.json"),
        ("closure/installed-dependencies-proof.json", "installed-dependencies/installed-dependencies-proof.json"),
        ("dependencies-execution.log.txt", "installed-dependencies/dependencies-execution.log.txt"),
        ("core-runner-execution.log.txt", "core/core-runner-execution.log.txt"),
        ("closure-execution.log.txt", "closure/closure-execution.log.txt"),
        ("driver-input-audit-execution.log.txt", "closure/driver-input-audit-execution.log.txt"),
        ("static-imports-execution-first.log.txt", "closure/static-imports-execution-first.log.txt"),
        ("static-imports-execution-second.log.txt", "closure/static-imports-execution-second.log.txt"),
        ("snapshot.json", "snapshot/snapshot.json"),
        ("snapshot-execution.log.txt", "snapshot/snapshot-execution.log.txt"),
        ("inspect-build-execution.log.txt", "build-boundary/inspect-build-execution.log.txt"),
        ("server-identity.json", "server-identity/server-identity.json"),
        ("server-startup.log.txt", "startup/server-startup.log.txt"),
    ])
    mappings.sort(key=lambda item: item[1])
    if len({target for _, target in mappings}) != len(mappings):
        raise RuntimeError("Duplicate destination")
    reserved = [target for _, target in mappings] + [
        "archive-proof/archive-records.py", "archive-proof/report.json"
    ]
    for relative in reserved:
        path = destination / relative
        if path.exists() or path.is_symlink():
            raise RuntimeError(f"Refusing existing destination: {path}")
        if path.parent.exists() and path.parent.resolve() != path.parent:
            raise RuntimeError(f"Refusing destination through a symlink: {path}")
    source_paths = sorted({relative for relative, _ in mappings})
    for relative in source_paths:
        path = source / relative
        if not path.is_file() or path.is_symlink():
            raise RuntimeError(f"Expected regular source evidence: {path}")
    before = {relative: digest(source / relative) for relative in source_paths}
    started = datetime.now(timezone.utc).isoformat()
    for relative, target in mappings:
        data = (source / relative).read_bytes()
        actual = {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        if actual != before[relative]:
            raise RuntimeError(f"Source changed before copy: {relative}")
        path = destination / target
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as out:
            out.write(data)
    script_data = script.read_bytes()
    script_target = destination / "archive-proof/archive-records.py"
    script_target.parent.mkdir(parents=True, exist_ok=True)
    with script_target.open("xb") as out:
        out.write(script_data)
    after = {relative: digest(source / relative) for relative in source_paths}
    inventories_after = {
        group: inventory(source / group, ("README.md",) if group == "build-boundary" else ())
        for group in inventories_before
    }
    entries = []
    for relative, target in mappings:
        copied = digest(destination / target)
        entries.append({
            "source": relative,
            "destination": target,
            "sourceBefore": before[relative],
            "sourceAfter": after[relative],
            "destinationAfter": copied,
            "allEqual": before[relative] == after[relative] == copied,
        })
    passed = all(entry["allEqual"] for entry in entries) and inventories_before == inventories_after
    report = {
        "schemaVersion": 1,
        "purpose": "Byte-identical archive of authorized immutable c1 raw verification evidence only",
        "startedAt": started,
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "sourceRoot": str(source),
        "destinationRoot": str(destination),
        "pass": passed,
        "sourceBeforeAfterExact": before == after,
        "destinationMatchesSource": all(entry["allEqual"] for entry in entries),
        "selectedDirectoryInventoryUnchanged": inventories_before == inventories_after,
        "uniqueSourceFiles": len(source_paths),
        "archivedRawFiles": len(entries),
        "uniqueSourceBytes": sum(item["bytes"] for item in before.values()),
        "archivedRawBytes": sum(item["sourceBefore"]["bytes"] for item in entries),
        "sourceInventoryBefore": inventories_before,
        "sourceInventoryAfter": inventories_after,
        "excluded": ["candidate/**", "prepared/**", "regressions/**", "build-boundary/README.md", "execution-handoff.json"],
        "notes": [
            "No build, browser, Blender, core, or docs check was executed by this archive script.",
            "The candidate tree was neither copied nor modified by this archive script.",
            "Raw JSON and logs are unchanged; recorded absolute run paths remain original provenance.",
            "The initial static import failure is preserved as both raw JSON and its .log.txt output.",
            "Two small installed dependency JSON files are also retained at their original closure paths.",
            "This archive equality result does not confer an application or visual acceptance result."
        ],
        "archiver": {
            "source": str(script),
            "destination": "archive-proof/archive-records.py",
            "sourceSha256": hashlib.sha256(script_data).hexdigest(),
            "destinationAfter": digest(script_target),
        },
        "files": entries,
    }
    report_path = destination / "archive-proof/report.json"
    with report_path.open("x", encoding="utf-8", newline="\n") as out:
        json.dump(report, out, ensure_ascii=False, indent=2)
        out.write("\n")
    print(json.dumps({
        "pass": passed,
        "uniqueSourceFiles": len(source_paths),
        "archivedRawFiles": len(entries),
        "archivedRawBytes": report["archivedRawBytes"],
        "proof": str(report_path),
        "proofSha256": digest(report_path)["sha256"],
    }, ensure_ascii=False, indent=2))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
