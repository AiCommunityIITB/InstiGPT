import datetime
from typing import Annotated
import uuid
from fastapi import Cookie, HTTPException

from instigpt import config, db


async def get_user(
    session_id: Annotated[str | None, Cookie(alias=config.COOKIE_NAME)] = None
) -> db.user.User:
    if session_id is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    session = await db.session.get_by_id(uuid.UUID(session_id))
    if session is None or session.expires_at < datetime.datetime.now():
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await db.user.get_user_by_id(session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return user
