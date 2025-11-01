"""Initial schema migration for InstiGPT.

This migration creates the base database schema including:
- user: User accounts with authentication details
- session: User session management with expiration tracking
- conversation: Chat conversation metadata
- message: Individual messages within conversations

Revision ID: 20241031_0001
Revises:
Create Date: 2024-10-31 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Uuid


# revision identifiers, used by Alembic.
revision: str = "20241031_0001"
down_revision: Union[str, Sequence[str], None] = None


MESSAGE_ROLE_ENUM_NAME = "messagerole"


def upgrade() -> None:
    """Create initial database schema.

    Creates tables for users, sessions, conversations, and messages with
    appropriate foreign key relationships and constraints.
    """
    message_role_enum = sa.Enum(
        "assistant",
        "user",
        name=MESSAGE_ROLE_ENUM_NAME,
    )
    message_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("roll_number", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "session",
        sa.Column("id", Uuid(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "conversation",
        sa.Column("id", Uuid(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "message",
        sa.Column("id", Uuid(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("role", message_role_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("conversation_id", Uuid(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversation.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("message")
    op.drop_table("conversation")
    op.drop_table("session")
    op.drop_table("user")

    message_role_enum = sa.Enum(
        "assistant",
        "user",
        name=MESSAGE_ROLE_ENUM_NAME,
    )
    message_role_enum.drop(op.get_bind(), checkfirst=True)
