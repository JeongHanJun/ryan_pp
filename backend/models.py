from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    BigInteger, DateTime, ForeignKey, Index, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(String(40), nullable=False)
    birth_year: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class Big5Result(Base):
    __tablename__ = "big5_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    test_code: Mapped[str] = mapped_column(String(32), nullable=False)
    score_o: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_c: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_e: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_a: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    score_n: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    lang: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class MbtiResult(Base):
    __tablename__ = "mbti_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    test_code: Mapped[str] = mapped_column(String(32), nullable=False)
    mbti_type: Mapped[str] = mapped_column(String(4), nullable=False)
    scores: Mapped[dict] = mapped_column(JSONB, nullable=False)
    character_set: Mapped[str] = mapped_column(String(32), nullable=False)
    character_id: Mapped[str] = mapped_column(String(64), nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False)
    lang: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class GameScore(Base):
    __tablename__ = "game_scores"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    game_type: Mapped[str] = mapped_column(String(32), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


# Indexes for stats/leaderboard queries.
Index("idx_big5_user_created", Big5Result.user_id, Big5Result.created_at.desc())
Index("idx_mbti_user_created", MbtiResult.user_id, MbtiResult.created_at.desc())
Index("idx_mbti_type_created", MbtiResult.mbti_type, MbtiResult.created_at.desc())
Index("idx_game_user_type", GameScore.user_id, GameScore.game_type)
Index("idx_game_type_score", GameScore.game_type, GameScore.score.desc())
Index("idx_game_type_created", GameScore.game_type, GameScore.created_at.desc())
