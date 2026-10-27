"""Exercise byte seeking against the running local media server."""
import unittest
import urllib.error
import urllib.request
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / 'assets/v5-motion-clean-street/arrival-preview.mp4'
URL = 'http://127.0.0.1:4317/assets/v5-motion-clean-street/arrival-preview.mp4'


class MediaRangeTests(unittest.TestCase):
    def test_prefix_range(self) -> None:
        request = urllib.request.Request(URL, headers={'Range': 'bytes=0-1023'})
        with urllib.request.urlopen(request, timeout=10) as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(response.headers['Content-Range'], f'bytes 0-1023/{SOURCE.stat().st_size}')
            self.assertEqual(response.headers['Accept-Ranges'], 'bytes')
            self.assertEqual(response.read(), SOURCE.read_bytes()[:1024])

    def test_suffix_and_open_end(self) -> None:
        data = SOURCE.read_bytes()
        for header, expected in [('bytes=-64', data[-64:]), (f'bytes={len(data)-64}-', data[-64:])]:
            with self.subTest(header=header):
                with urllib.request.urlopen(urllib.request.Request(URL, headers={'Range': header}), timeout=10) as response:
                    self.assertEqual(response.status, 206)
                    self.assertEqual(response.read(), expected)

    def test_unsatisfiable_range(self) -> None:
        request = urllib.request.Request(URL, headers={'Range': f'bytes={SOURCE.stat().st_size}-'})
        with self.assertRaises(urllib.error.HTTPError) as raised:
            urllib.request.urlopen(request, timeout=10)
        self.assertEqual(raised.exception.code, 416)
        self.assertEqual(raised.exception.headers['Content-Range'], f'bytes */{SOURCE.stat().st_size}')
        raised.exception.close()

    def test_range_head_has_correct_length_without_body(self) -> None:
        request = urllib.request.Request(URL, headers={'Range': 'bytes=0-1023'}, method='HEAD')
        with urllib.request.urlopen(request, timeout=10) as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(response.headers['Content-Length'], '1024')
            self.assertEqual(response.read(), b'')

    def test_normal_get_preserves_source(self) -> None:
        with urllib.request.urlopen(URL, timeout=10) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), SOURCE.read_bytes())


if __name__ == '__main__':
    unittest.main()
