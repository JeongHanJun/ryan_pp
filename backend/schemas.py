from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=40)
    birth_year: int = Field(ge=1900, le=2100)
    gender: Optional[str] = Field(default=None, max_length=16)
    region: Optional[str] = Field(default=None, max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class UserProfile(BaseModel):
    id: int
    email: str
    display_name: str
    birth_year: int
    gender: Optional[str] = None
    region: Optional[str] = None


# ── Results ───────────────────────────────────────────────────────────────

class Big5SubmitRequest(BaseModel):
    test_code: str = "big5_v1"
    score_0_100: Dict[str, float]  # {O, C, E, A, N}
    answers: Dict[str, int]
    lang: str = "kr"


class MbtiSubmitRequest(BaseModel):
    test_code: str = "mbti_v1"
    mbti_type: str = Field(min_length=4, max_length=4)
    score_0_100: Dict[str, float]  # 8 axes
    character_set: str
    character_id: str
    answers: Dict[str, int]
    lang: str = "kr"


class GameScoreSubmitRequest(BaseModel):
    game_type: str
    score: int = Field(ge=0)


class ResultCreatedResponse(BaseModel):
    id: int
    created_at: datetime


class Big5HistoryItem(BaseModel):
    id: int
    test_code: str
    score_o: float
    score_c: float
    score_e: float
    score_a: float
    score_n: float
    lang: str
    created_at: datetime


class MbtiHistoryItem(BaseModel):
    id: int
    test_code: str
    mbti_type: str
    scores: Dict[str, float]
    character_set: str
    character_id: str
    lang: str
    created_at: datetime


class GameBestItem(BaseModel):
    game_type: str
    best_score: int
    play_count: int


# ── Popular (dashboard) ───────────────────────────────────────────────────

class MbtiDistributionBucket(BaseModel):
    mbti_type: str
    count: int
    ratio: float  # 0~1


class MbtiDistribution(BaseModel):
    total: int
    buckets: List[MbtiDistributionBucket]
    my_type: Optional[str] = None
    my_rank: Optional[int] = None


class GameLeaderboardItem(BaseModel):
    rank: int
    display_name: str
    best_score: int
    is_me: bool = False


class GameLeaderboard(BaseModel):
    game_type: str
    total_players: int
    top: List[GameLeaderboardItem]
    me: Optional[GameLeaderboardItem] = None


class TrendBucket(BaseModel):
    key: str
    label: str
    count: int


class PopularTrends(BaseModel):
    window_days: int
    top_mbti: List[TrendBucket]
    top_games: List[TrendBucket]
    new_users_7d: int
    total_users: int


class TimelineItem(BaseModel):
    kind: Literal["big5", "mbti", "game"]
    id: int
    summary: str
    created_at: datetime


class PopularMeResponse(BaseModel):
    latest_mbti: Optional[MbtiHistoryItem] = None
    latest_big5: Optional[Big5HistoryItem] = None
    age_mbti_distribution: Optional[MbtiDistribution] = None
    age_big5_average: Optional[Dict[str, float]] = None
    timeline: List[TimelineItem]
