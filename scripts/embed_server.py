"""
Local embedding server.
Runs the same BGE model used during indexing.
API calls this at query time for real semantic search.

Start: python scripts/embed_server.py
Runs on: http://localhost:9999
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from sentence_transformers import SentenceTransformer

print("Loading model...")
model = SentenceTransformer("BAAI/bge-base-en-v1.5")
print("Ready on http://localhost:9999")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        text = body.get("text", "")

        embedding = model.encode([text], normalize_embeddings=True)[0].tolist()

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"embedding": embedding}).encode())

    def log_message(self, *args):
        pass  # suppress logs


HTTPServer(("0.0.0.0", 9999), Handler).serve_forever()
