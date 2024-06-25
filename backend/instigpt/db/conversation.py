from typing import Annotated, Optional, Sequence, List
import enum
from datetime import datetime
import uuid

from pydantic import BaseModel, Field
from beanie import Document, Indexed


class MessageRole(enum.Enum):
    ASSISTANT = "assistant"
    USER = "user"


class Message(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    content: str
    role: MessageRole = Field(
        description="The role of the user that sent the message",
    )
    created_at: datetime = Field(default_factory=datetime.now)


class Conversation(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    title: str
    owner_id: Annotated[uuid.UUID, Indexed]
    created_at: datetime = Field(default_factory=datetime.now)
    messages: List[Message] = Field(default_factory=list)


class ConversationShortView(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime

    class Settings:
        projection = {"id": "$_id", "title": 1, "created_at": 1}


async def get_conversations_of_user(user_id: uuid.UUID) -> Sequence[Conversation]:
    return (
        await Conversation.find_many(Conversation.owner_id == user_id)
        .project(ConversationShortView)
        .to_list()
    )


async def get_messages_of_conversation(conversation_id: uuid.UUID) -> Sequence[Message]:
    conversation = await Conversation.find_one(Conversation.id == conversation_id)
    if conversation is None:
        return []

    return conversation.messages


async def create_conversation(conversation: Conversation) -> None:
    await conversation.insert()


async def update_conversation(
    conversation_id: uuid.UUID, new_title: str
) -> Optional[Conversation]:
    conversation = await Conversation.find_one(Conversation.id == conversation_id)
    if not conversation:
        return

    conversation.title = new_title
    await conversation.save()

    del conversation.messages
    return ConversationShortView(conversation)


async def delete_conversation(conversation_id: uuid.UUID):
    conversation = await Conversation.find_one(Conversation.id == conversation_id)
    if not conversation:
        return
    conversation.delete()


async def create_message(conversation_id: uuid.UUID, message: Message):
    conversation = await Conversation.find_one(Conversation.id == conversation_id)
    if not conversation:
        return

    conversation.messages.append(message)
    await conversation.save()
