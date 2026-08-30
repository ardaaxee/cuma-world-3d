#!/usr/bin/env python3
"""Audit the packaged CUMA WORLD audio assets.

Dependency-free: WAV is parsed with the standard library `wave` module, with a
raw RIFF fallback so a malformed file produces a useful diagnosis rather than a
stack trace. No FFmpeg, no third-party audio library.

It prints an AUDIO REPORT and then enforces two separate contracts:

  1. hard requirements -> non-zero exit; a packaged file that is malformed or
     absurd must not ship
  2. optional assets   -> a missing file is reported as a runtime fallback and
     is explicitly NOT a failure, because the runtime synthesises those cues

Audio is presentation only. Nothing here affects the authoritative gameplay
noise model that drives NPC hearing.
"""

from __future__ import annotations

import argparse
import struct
import sys
import wave
from pathlib import Path

# Assets the workflow copies out of the source archive when present. Every one
# is optional at runtime: the audio owner falls back to synthesis.
DECLARED_ASSETS: tuple[str, ...] = (
    "city_ambience.wav",
    "footstep_a.wav",
    "footstep_b.wav",
)

# --- Android budgets -------------------------------------------------------
# Derived from the measured baseline (audited 2026-08-29):
#   city_ambience.wav 793,844 B | footstep_a.wav 5,114 B | footstep_b.wav 4,454 B
#   total 803,412 B
# Ceilings leave room for a few more short cues and one longer bed without
# letting an uncompressed desktop-sized payload into a mobile APK.
MAX_TOTAL_AUDIO_BYTES = 12 * 1024 * 1024
MAX_SINGLE_ASSET_BYTES = 6 * 1024 * 1024
WARN_SINGLE_ASSET_BYTES = 2 * 1024 * 1024
# A stereo 48 kHz bed is the most anything here should ever be.
MAX_SAMPLE_RATE = 48_000
MIN_SAMPLE_RATE = 8_000
MAX_CHANNELS = 2
# A one-shot longer than this is a bed, not a cue; a bed longer than this is
# wasting APK space that should be a loop.
MAX_DURATION_SECONDS = 120.0


class AudioAsset:
    def __init__(self, name: str, path: Path) -> None:
        self.name = name
        self.path = path
        self.present = path.is_file()
        self.bytes = path.stat().st_size if self.present else 0
        self.channels = 0
        self.sample_rate = 0
        self.sample_width = 0
        self.frames = 0
        self.duration = 0.0
        self.malformed = ""
        self.codec = "unknown"

    def probe(self) -> None:
        if not self.present:
            return
        try:
            with wave.open(str(self.path), "rb") as handle:
                self.channels = handle.getnchannels()
                self.sample_rate = handle.getframerate()
                self.sample_width = handle.getsampwidth()
                self.frames = handle.getnframes()
                self.codec = "pcm"
                if self.sample_rate > 0:
                    self.duration = self.frames / float(self.sample_rate)
        except (wave.Error, EOFError, OSError) as exc:
            self.malformed = str(exc)
            self.describe_riff()

    def describe_riff(self) -> None:
        """Best-effort RIFF header read so a malformed file still says why."""
        try:
            head = self.path.read_bytes()[:44]
        except OSError:
            return
        if len(head) < 12 or head[:4] != b"RIFF" or head[8:12] != b"WAVE":
            self.codec = "not-riff-wave"
            return
        self.codec = "riff-wave"
        if len(head) >= 34:
            fmt_tag, channels, rate = struct.unpack_from("<HHI", head, 20)
            self.codec = f"riff-wave(fmt={fmt_tag})"
            self.channels = self.channels or channels
            self.sample_rate = self.sample_rate or rate

    @property
    def bit_depth(self) -> int:
        return self.sample_width * 8


def audit(directory: Path) -> tuple[list[AudioAsset], list[str], list[str]]:
    assets: list[AudioAsset] = []
    for name in DECLARED_ASSETS:
        asset = AudioAsset(name, directory / name)
        asset.probe()
        assets.append(asset)

    errors: list[str] = []
    warnings: list[str] = []
    total = 0

    for asset in assets:
        if not asset.present:
            # Optional by contract: the runtime synthesises a fallback.
            continue
        total += asset.bytes
        if asset.malformed:
            errors.append(f"{asset.name} is packaged but unreadable as WAV: {asset.malformed}")
            continue
        if asset.bytes > MAX_SINGLE_ASSET_BYTES:
            errors.append(f"{asset.name} is {asset.bytes} B, over the {MAX_SINGLE_ASSET_BYTES} B single-asset budget")
        elif asset.bytes > WARN_SINGLE_ASSET_BYTES:
            warnings.append(f"{asset.name} is {asset.bytes} B, above the {WARN_SINGLE_ASSET_BYTES} B comfort target")
        if asset.channels < 1 or asset.channels > MAX_CHANNELS:
            errors.append(f"{asset.name} declares {asset.channels} channels (max {MAX_CHANNELS})")
        if not MIN_SAMPLE_RATE <= asset.sample_rate <= MAX_SAMPLE_RATE:
            errors.append(
                f"{asset.name} sample rate {asset.sample_rate} Hz is outside "
                f"{MIN_SAMPLE_RATE}-{MAX_SAMPLE_RATE} Hz"
            )
        if asset.frames <= 0:
            errors.append(f"{asset.name} contains no audio frames")
        if asset.duration > MAX_DURATION_SECONDS:
            errors.append(f"{asset.name} is {asset.duration:.1f}s, over the {MAX_DURATION_SECONDS:.0f}s budget")

    if total > MAX_TOTAL_AUDIO_BYTES:
        errors.append(f"packaged audio totals {total} B, over the {MAX_TOTAL_AUDIO_BYTES} B budget")

    return assets, errors, warnings


def report(directory: Path, assets: list[AudioAsset]) -> None:
    present = [asset for asset in assets if asset.present]
    missing = [asset for asset in assets if not asset.present]
    total = sum(asset.bytes for asset in present)

    print("=== AUDIO REPORT ===")
    print(f"audio_directory={directory}")
    print(f"audio_declared_assets={len(assets)}")
    print(f"audio_present_assets={len(present)}")
    print(f"audio_missing_assets={len(missing)}")
    print(f"audio_total_bytes={total}")
    for asset in assets:
        if not asset.present:
            print(f"audio_asset name={asset.name} status=missing runtime=procedural-fallback")
            continue
        print(
            f"audio_asset name={asset.name} status=packaged bytes={asset.bytes} "
            f"codec={asset.codec} channels={asset.channels} sample_rate={asset.sample_rate} "
            f"bit_depth={asset.bit_depth} frames={asset.frames} duration={asset.duration:.3f}"
            + (f" malformed={asset.malformed}" if asset.malformed else "")
        )
    print("=== END AUDIO REPORT ===")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit packaged CUMA WORLD audio assets")
    parser.add_argument("directory", nargs="?", default="public/assets/audio")
    parser.add_argument(
        "--require-packaged",
        action="store_true",
        help="fail when a declared asset is missing (CI uses this only when the archive supplied audio)",
    )
    args = parser.parse_args()

    directory = Path(args.directory)
    assets, errors, warnings = audit(directory)
    report(directory, assets)

    for warning in warnings:
        print(f"AUDIO_WARN: {warning}")

    if args.require_packaged:
        for asset in assets:
            if not asset.present:
                errors.append(f"{asset.name} was expected to be packaged but is missing")

    if errors:
        for error in errors:
            print(f"AUDIO_ERROR: {error}", file=sys.stderr)
        raise SystemExit("AUDIO_INVALID: packaged audio contract not satisfied")

    print("AUDIO_OK")


if __name__ == "__main__":
    main()
