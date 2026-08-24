from __future__ import annotations

import base64
import io
import math
import random
import struct
import tarfile
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTS_DIR = ROOT / '.build' / 'source_parts'
GAME = ROOT / 'game'


def safe_extract_targz(data: bytes, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tf:
        root = destination.resolve()
        for member in tf.getmembers():
            target = (destination / member.name).resolve()
            if target != root and root not in target.parents:
                raise RuntimeError(f'Unsafe archive member: {member.name}')
        tf.extractall(destination)


def png_chunk(tag: bytes, payload: bytes) -> bytes:
    return struct.pack('>I', len(payload)) + tag + payload + struct.pack('>I', zlib.crc32(tag + payload) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, pixel_fn) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            r, g, b = pixel_fn(x, y, width, height)
            raw.extend((max(0, min(255, int(r))), max(0, min(255, int(g))), max(0, min(255, int(b)))))
    data = b'\x89PNG\r\n\x1a\n'
    data += png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    data += png_chunk(b'IDAT', zlib.compress(bytes(raw), 7))
    data += png_chunk(b'IEND', b'')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def noise(x: int, y: int, seed: int) -> float:
    n = (x * 374761393 + y * 668265263 + seed * 69069) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    n ^= n >> 16
    return (n & 0xFFFF) / 65535.0


def albedo_fn(kind: str, seed: int):
    palettes = {
        'plaster': (212, 207, 195), 'oak': (139, 96, 58), 'fabric': (139, 120, 103),
        'stone': (145, 145, 140), 'tile': (213, 211, 205), 'asphalt': (55, 58, 61),
        'concrete': (150, 151, 148), 'linen': (181, 170, 151), 'marble': (205, 205, 199),
        'backsplash': (190, 195, 194), 'walnut': (92, 58, 38), 'porcelain': (215, 216, 213),
    }
    base = palettes[kind]

    def fn(x, y, w, h):
        n = noise(x // 2, y // 2, seed) - 0.5
        r, g, b = base
        if kind in {'oak', 'walnut'}:
            grain = math.sin((x * 0.08) + 4.0 * math.sin(y * 0.015)) * 9 + n * 18
            return r + grain, g + grain * 0.72, b + grain * 0.45
        if kind in {'fabric', 'linen'}:
            weave = ((x % 6 == 0) + (y % 6 == 0)) * 7 + n * 12
            return r + weave, g + weave, b + weave
        if kind in {'tile', 'porcelain'}:
            grout = 34 if x % 96 < 3 or y % 96 < 3 else 0
            return r - grout + n * 8, g - grout + n * 8, b - grout + n * 8
        if kind == 'marble':
            vein = abs(math.sin(x * 0.025 + math.sin(y * 0.035) * 3))
            shade = -28 if vein > 0.94 else n * 10
            return r + shade, g + shade, b + shade
        if kind == 'backsplash':
            grout = 42 if x % 64 < 2 or y % 32 < 2 else 0
            return r - grout + n * 6, g - grout + n * 6, b - grout + n * 6
        if kind == 'asphalt':
            speck = 24 if noise(x, y, seed + 10) > 0.985 else 0
            return r + n * 24 + speck, g + n * 24 + speck, b + n * 24 + speck
        return r + n * 15, g + n * 15, b + n * 15

    return fn


def normal_fn(kind: str, seed: int):
    def fn(x, y, w, h):
        nx = (noise(x, y, seed) - 0.5) * 20
        ny = (noise(x + 17, y + 31, seed + 1) - 0.5) * 20
        if kind in {'oak', 'walnut'}:
            nx += math.sin(y * 0.09) * 9
        elif kind in {'fabric', 'linen'}:
            nx += 8 if x % 6 == 0 else 0
            ny += 8 if y % 6 == 0 else 0
        elif kind in {'tile', 'porcelain'}:
            nx += -18 if x % 96 < 3 else 0
            ny += -18 if y % 96 < 3 else 0
        return 128 + nx, 128 + ny, 244
    return fn


def write_audio() -> None:
    audio = GAME / 'assets' / 'audio'
    audio.mkdir(parents=True, exist_ok=True)
    rate = 22050
    for name, seed in [('footstep_a.wav', 11), ('footstep_b.wav', 29)]:
        rnd = random.Random(seed)
        with wave.open(str(audio / name), 'wb') as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(rate)
            frames = bytearray()
            count = int(rate * 0.14)
            for i in range(count):
                env = max(0.0, 1.0 - i / count)
                sample = (math.sin(i * 0.18) * 0.55 + (rnd.random() * 2 - 1) * 0.45) * env
                frames += struct.pack('<h', int(sample * 9000))
            wf.writeframes(frames)

    rnd = random.Random(73)
    with wave.open(str(audio / 'city_ambience.wav'), 'wb') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(rate)
        frames = bytearray()
        count = rate * 8
        slow = 0.0
        for i in range(count):
            slow = slow * 0.995 + (rnd.random() * 2 - 1) * 0.005
            hum = math.sin(2 * math.pi * 72 * i / rate) * 0.08
            sample = (slow * 0.38 + hum) * 3000
            frames += struct.pack('<h', int(max(-32767, min(32767, sample))))
        wf.writeframes(frames)


def write_materials() -> None:
    mats = GAME / 'assets' / 'materials'
    mats.mkdir(parents=True, exist_ok=True)
    base_assets = {
        'asphalt.png': 'asphalt', 'backsplash.png': 'backsplash', 'concrete.png': 'concrete',
        'fabric.png': 'fabric', 'linen.png': 'linen', 'marble.png': 'marble',
        'oak_floor.png': 'oak', 'plaster.png': 'plaster', 'porcelain_tile.png': 'porcelain',
        'stone.png': 'stone', 'walnut.png': 'walnut',
    }
    for idx, (filename, kind) in enumerate(base_assets.items()):
        write_png(mats / filename, 256, 256, albedo_fn(kind, 100 + idx))

    prod = mats / 'production'
    prod.mkdir(parents=True, exist_ok=True)
    for idx, kind in enumerate(['plaster', 'oak', 'fabric', 'stone', 'tile']):
        write_png(prod / f'{kind}_albedo.png', 512, 512, albedo_fn(kind, 300 + idx))
        write_png(prod / f'{kind}_normal.png', 512, 512, normal_fn(kind, 500 + idx))


def main() -> None:
    parts = sorted(PARTS_DIR.glob('source.b64.part-*'))
    if not parts:
        raise SystemExit('No source bundle parts found')
    encoded = ''.join(p.read_text(encoding='ascii') for p in parts)
    archive = base64.b64decode(encoded)
    if GAME.exists():
        import shutil
        shutil.rmtree(GAME)
    safe_extract_targz(archive, GAME)
    write_materials()
    write_audio()
    print(f'Prepared Godot project at {GAME}')
    print(f'Files: {sum(1 for p in GAME.rglob("*") if p.is_file())}')


if __name__ == '__main__':
    main()
