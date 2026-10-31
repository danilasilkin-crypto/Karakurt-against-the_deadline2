from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

os.chdir(Path(__file__).resolve().parent)
server = ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler)
print(f'http://127.0.0.1:{server.server_port}', flush=True)
server.serve_forever()
