from logging import info
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from .conversation import Conversation
from .session import Session
from .user import User


@asynccontextmanager
async def initialize_db_lifespan(app: FastAPI):
    client = AsyncIOMotorClient(os.environ["DATABASE_URL"])
    await init_beanie(
        database=client.db_name, document_models=[Conversation, Session, User]
    )

    # Check if connected successfully
    ping_resp = await client.get_default_database().command("ping")
    if int(ping_resp["ok"]) != 1:
        raise Exception("Problem connecting to database cluster.")
    else:
        info("Connected to database cluster.")

    yield

    # Shutdown
    client.close()
