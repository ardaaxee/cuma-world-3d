import json
import struct
import unittest
from glb_validation import read_glb_document


def fixture(view_length=4):
    doc = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': 4}],
           'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': view_length}]}
    payload = json.dumps(doc).encode()
    payload += b' ' * (-len(payload) % 4)
    chunks = struct.pack('<I4s', len(payload), b'JSON') + payload + struct.pack('<I4s', 4, b'BIN\0') + b'1234'
    return struct.pack('<4sII', b'glTF', 2, len(chunks) + 12) + chunks


class ContainerTests(unittest.TestCase):
    def test_valid_embedded_container(self):
        self.assertEqual(read_glb_document(fixture())['buffers'][0]['byteLength'], 4)

    def test_truncated_binary_with_intact_json_is_rejected(self):
        with self.assertRaises(ValueError):
            read_glb_document(fixture()[:-2])

    def test_truncated_chunk_even_with_rewritten_total_is_rejected(self):
        data = bytearray(fixture()[:-2])
        struct.pack_into('<I', data, 8, len(data))
        with self.assertRaises(ValueError):
            read_glb_document(bytes(data))

    def test_out_of_bounds_geometry_is_rejected(self):
        with self.assertRaises(ValueError):
            read_glb_document(fixture(8))

    def test_trailing_unaccounted_data_is_rejected(self):
        with self.assertRaises(ValueError):
            read_glb_document(fixture() + b'xxxx')


if __name__ == '__main__':
    unittest.main()
