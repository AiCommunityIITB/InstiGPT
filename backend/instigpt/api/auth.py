import datetime
from typing import Annotated
import uuid

import argon2
from fastapi import APIRouter, Cookie, HTTPException, Depends
from fastapi.responses import JSONResponse, Response

from instigpt import config, db
from . import helpers
from .input_models import RegisterInput, LoginInput

router = APIRouter()
hasher = argon2.PasswordHasher()


@router.post("/register")
async def register(input: RegisterInput):
    user = await db.user.get_user_by_username(input.username)
    if user is not None:
        raise HTTPException(status_code=400, detail="User already exists")

    user = db.user.User(
        username=input.username,
        password=hasher.hash(input.password),
        name=input.name,
    )
    await db.user.create_user(user)

    return JSONResponse({"success": True}, status_code=204)


@router.post("/login")
async def login(input: LoginInput, response: Response):
    user = await db.user.get_user_by_username(input.username)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Either a user with that username does not exist or the password is incorrect",
        )

    try:
        hasher.verify(user.password, input.password)

        if hasher.check_needs_rehash(user.password):
            db.user.update_user_password(user.id, hasher.hash(input.password))
    except argon2.exceptions.VerifyMismatchError:
        raise HTTPException(
            status_code=401,
            detail="Either a user with that username does not exist or the password is incorrect",
        )

    session = db.session.Session(
        user_id=user.id,
        expires_at=datetime.datetime.now() + datetime.timedelta(days=7),
    )
    await db.session.create(session)

    response.set_cookie(
        config.COOKIE_NAME,
        str(session.id),
        max_age=60 * 60 * 24 * 7,
        httponly=True,
    )
    del user.password
    return {"user": user}


@router.get("/logout")
async def logout(
    res: Response,
    session_id: Annotated[str | None, Cookie(alias=config.COOKIE_NAME)] = None,
):
    if session_id is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    await db.session.delete(uuid.UUID(session_id))
    res.delete_cookie(config.COOKIE_NAME)
    return {"success": True}


@router.get("/me")
async def me(user: Annotated[db.user.User, Depends(helpers.get_user)]):
    del user.password
    return {"user": user}
