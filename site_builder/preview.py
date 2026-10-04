import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 8000
LOCAL_HOST = "127.0.0.1"


class FreshFileHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        """Tell the browser to fetch every file again, so changes show up on a normal reload."""
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    """Serve the site folder on this computer without browser caching."""
    parser = argparse.ArgumentParser(prog="python -m site_builder.preview", description="Preview the travel site locally.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port to serve the site on")
    parser.add_argument("--site-dir", type=Path, default=PROJECT_ROOT / "docs", help="GitHub Pages folder to serve")
    arguments = parser.parse_args()
    handler = functools.partial(FreshFileHandler, directory=str(arguments.site_dir.resolve()))
    with ThreadingHTTPServer((LOCAL_HOST, arguments.port), handler) as server:
        print(f"Previewing at http://localhost:{arguments.port} (press Ctrl+C to stop)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("Stopped")


if __name__ == "__main__":
    main()
