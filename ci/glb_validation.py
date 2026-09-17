"""Validate complete, embedded GLB containers before metadata inspection/import."""
import json
import struct


def read_glb_document(data: bytes) -> dict:
    if len(data) < 20:
        raise ValueError('GLB header or first chunk is truncated')
    magic, version, declared = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2:
        raise ValueError('Expected a GLB version 2 container')
    if declared != len(data):
        raise ValueError(f'GLB length mismatch: declared {declared}, actual {len(data)}')
    offset = 12
    chunks = []
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError('Truncated GLB chunk header')
        length, kind = struct.unpack_from('<I4s', data, offset)
        end = offset + 8 + length
        if length % 4 or end > len(data):
            raise ValueError('Unaligned or truncated GLB chunk payload')
        chunks.append((kind, data[offset + 8:end]))
        offset = end
    if not chunks or chunks[0][0] != b'JSON':
        raise ValueError('First GLB chunk must be JSON')
    if sum(kind == b'JSON' for kind, _ in chunks) != 1:
        raise ValueError('Duplicate JSON chunk')
    doc = json.loads(chunks[0][1].decode('utf-8'))
    binaries = [payload for kind, payload in chunks if kind == b'BIN\0']
    buffers = doc.get('buffers', [])
    # This pipeline deliberately accepts self-contained character assets only.
    if len(buffers) != 1 or 'uri' in buffers[0] or len(binaries) != 1:
        raise ValueError('Expected exactly one embedded binary buffer')
    required = buffers[0].get('byteLength', -1)
    if not isinstance(required, int) or required < 0 or not 0 <= len(binaries[0]) - required <= 3:
        raise ValueError('Embedded buffer length mismatch')
    for view in doc.get('bufferViews', []):
        start, size = view.get('byteOffset', 0), view.get('byteLength', -1)
        if view.get('buffer') != 0 or not isinstance(start, int) or not isinstance(size, int):
            raise ValueError('Invalid bufferView')
        if start < 0 or size < 0 or start + size > required:
            raise ValueError('bufferView exceeds embedded buffer')
    return doc
