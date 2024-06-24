from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from instigpt import config, db
from . import auth, conversation

app = FastAPI(lifespan=db.initialize_db_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(conversation.router)


@app.get("/")
async def status():
    return {"status": "up"}


@app.exception_handler(500)
async def internal_server_error_handler(request, exc):
    return JSONResponse(
        {"detail": "Something went wrong! We are looking into it."}, status_code=500
    )
