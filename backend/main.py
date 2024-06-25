import os
from dotenv import load_dotenv

env = "development" if os.environ.get("PYTHON_ENV") is None else "production"
load_dotenv(f".env.{env}")

import uvicorn

# NOTE: Do not remove this import. It is used by uvicorn to load the app
from instigpt.api import app

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        log_level="warning" if env == "production" else "info",
        reload=False if env == "production" else True,
        workers=8,
    )
