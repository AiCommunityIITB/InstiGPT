from typing import Optional
import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlmodel import create_engine
from sqlalchemy import Engine

_engine: Optional[Engine] = None


def get_engine() -> Engine:
    global _engine
    if _engine is not None:
        return _engine

    _engine = create_engine(os.environ["DATABASE_URL"])

    return _engine


def run_migrations():
    alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    alembic_cfg.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[1] / "alembic")
    )
    alembic_cfg.set_main_option(
        "sqlalchemy.url", os.environ["DATABASE_URL"]
    )
    command.upgrade(alembic_cfg, "head")
