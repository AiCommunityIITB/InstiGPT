# Embedder
EMBEDDING_MODEL = "voyage-large-2"
# EMBEDDING_MODEL = "jinaai/jina-embeddings-v2-base-en"
# EMBEDDING_MODEL = "models/embedding-001"

# Retriever
COLLECTION_NAME = "prototype-gemini-final"

# Generator
GENERATOR_MODEL = "gemini-pro"
GENERATOR_TEMPERATURE = 0

COOKIE_NAME = "session_id"

FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8080",
    "https://gymkhana.iitb.ac.in/instigpt",
]
