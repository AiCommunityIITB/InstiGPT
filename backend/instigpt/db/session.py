from typing import Annotated, Optional
from datetime import datetime
import uuid

from pydantic import Field
from beanie import Document, Indexed


class Session(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)  # type: ignore
    user_id: Annotated[uuid.UUID, Indexed]
    expires_at: datetime = Field(description="The time when the session expires")


async def get_by_id(id: uuid.UUID) -> Optional[Session]:
    return await Session.find_one(Session.id == id)


async def create(session: Session) -> None:
    await session.insert()


async def delete(id: uuid.UUID):
    session = await get_by_id(id)
    if session is None:
        return

    await session.delete()
