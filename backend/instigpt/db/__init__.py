from logging import info
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from .conversation import Conversation
from .document import Document
from .session import Session
from .user import User


async def initialize_db() -> AsyncIOMotorClient:
    client = AsyncIOMotorClient(os.environ["DATABASE_URL"])
    await init_beanie(
        database=client.db_name, document_models=[Conversation, Document, Session, User]
    )

    return client


@asynccontextmanager
async def initialize_db_lifespan(app: FastAPI):
    client = await initialize_db()

    # Check if connected successfully
    ping_resp = await client.get_default_database().command("ping")
    if int(ping_resp["ok"]) != 1:
        raise Exception("Problem connecting to database cluster.")
    else:
        info("Connected to database cluster.")

    yield

    # Shutdown
    client.close()
