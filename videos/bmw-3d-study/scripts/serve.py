from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import BinaryIO


def byte_range(value: str, size: int) -> tuple[int, int]:
    unit, bounds = value.split('=', 1)
    if unit != 'bytes' or ',' in bounds or size <= 0:
        raise ValueError('Unsupported byte range')
    first, last = bounds.split('-', 1)
    if not first:
        suffix = int(last)
        if suffix <= 0:
            raise ValueError('Empty suffix range')
        return max(0, size - suffix), size - 1
    start = int(first)
    end = min(int(last), size - 1) if last else size - 1
    if start < 0 or start >= size or end < start:
        raise ValueError('Unsatisfiable byte range')
    return start, end

class PreviewHandler(SimpleHTTPRequestHandler):
    _range_length: int | None = None
    _supports_ranges = False

    def end_headers(self) -> None:
        self.send_header('Cache-Control', 'no-store, max-age=0')
        if self._supports_ranges:
            self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self) -> BinaryIO | None:
        path = Path(self.translate_path(self.path))
        self._supports_ranges = path.is_file()
        self._range_length = None
        requested = self.headers.get('Range')
        if not requested or not self._supports_ranges:
            return super().send_head()
        size = path.stat().st_size
        try:
            start, end = byte_range(requested, size)
        except (ValueError, TypeError):
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        source = path.open('rb')
        source.seek(start)
        self._range_length = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self._range_length))
        self.send_header('Last-Modified', self.date_time_string(path.stat().st_mtime))
        self.end_headers()
        return source

    def copyfile(self, source: BinaryIO, outputfile: BinaryIO) -> None:
        if self._range_length is None:
            super().copyfile(source, outputfile)
            return
        remaining = self._range_length
        while remaining:
            block = source.read(min(64 * 1024, remaining))
            if not block:
                break
            outputfile.write(block)
            remaining -= len(block)

class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128

if __name__ == '__main__':
    handler = partial(PreviewHandler, directory=str(Path(__file__).resolve().parents[1]))
    with PreviewServer(('127.0.0.1', 4317), handler) as server:
        print('AutoFlow preview: http://127.0.0.1:4317/homepage.html', flush=True)
        server.serve_forever()
