from pydantic import BaseModel


class RegisterInput(BaseModel):
    username: str
    password: str
    name: str


class LoginInput(BaseModel):
    username: str
    password: str


class ChatInput(BaseModel):
    question: str


class CreateConversationInput(BaseModel):
    title: str
