from typing import Optional
import uuid

from pydantic import Field
from beanie import Document


class User(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    username: str
    password: str
    name: str


async def get_user_by_id(id: uuid.UUID) -> Optional[User]:
    return await User.find_one(User.id == id)


async def get_user_by_username(username: str) -> Optional[User]:
    return await User.find_one(User.username == username)


async def create_user(user: User) -> None:
    await user.insert()


async def update_user_password(id: uuid.UUID, new_password: str) -> None:
    user = await get_user_by_id(id)
    user.password = new_password
    await user.save()
