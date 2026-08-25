#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from PIL import Image
import statistics

BUILD = Path(__file__).resolve().parents[1] / "game" / "build"

# Broad art-direction gates, not image-matching tests. They catch accidental black
# rooms and blown-out lighting while leaving room for future material improvements.
LIMITS = {
    "visual_corridor.png": (0.22, 0.46),
    "visual_living_room.png": (0.22, 0.46),
    "visual_kitchen.png": (0.36, 0.68),
    "visual_bedroom.png": (0.23, 0.36),
}


def srgb_luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = rgb
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0


def image_metrics(path: Path) -> dict[str, float]:
    image = Image.open(path).convert("RGB")
    # Downsample for a deterministic, low-cost CI metric; this is an art guardrail,
    # not a perceptual benchmark.
    image.thumbnail((320, 180), Image.Resampling.BILINEAR)
    values = [srgb_luminance(pixel) for pixel in image.getdata()]
    values.sort()
    count = len(values)
    return {
        "mean": statistics.fmean(values),
        "median": statistics.median(values),
        "p10": values[int((count - 1) * 0.10)],
        "p90": values[int((count - 1) * 0.90)],
        "dark_ratio": sum(value < 0.15 for value in values) / count,
        "bright_ratio": sum(value > 0.75 for value in values) / count,
    }


def main() -> None:
    failures: list[str] = []
    for filename, (minimum, maximum) in LIMITS.items():
        path = BUILD / filename
        if not path.is_file():
            failures.append(f"missing {filename}")
            continue
        metrics = image_metrics(path)
        print(
            "CUMA_VISUAL_METRIC",
            filename,
            f"mean={metrics['mean']:.4f}",
            f"median={metrics['median']:.4f}",
            f"p10={metrics['p10']:.4f}",
            f"p90={metrics['p90']:.4f}",
            f"dark={metrics['dark_ratio']:.3f}",
            f"bright={metrics['bright_ratio']:.3f}",
            f"gate={minimum:.2f}..{maximum:.2f}",
        )
        if not minimum <= metrics["mean"] <= maximum:
            failures.append(
                f"{filename} mean luminance {metrics['mean']:.4f} outside {minimum:.2f}..{maximum:.2f}"
            )

    if failures:
        raise SystemExit("CUMA VISUAL METRICS: FAIL\n- " + "\n- ".join(failures))
    print("CUMA VISUAL METRICS: PASS")


if __name__ == "__main__":
    main()
