from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.deps import get_current_user
from backend.models import Big5Result, GameScore, MbtiResult, User
from backend.schemas import (
    Big5HistoryItem,
    Big5SubmitRequest,
    GameBestItem,
    GameScoreSubmitRequest,
    MbtiHistoryItem,
    MbtiSubmitRequest,
    ResultCreatedResponse,
)

router = APIRouter(prefix="/api/results", tags=["results"])

# Mirrors src/pages/PlayPage.jsx and src/games/*.
VALID_GAME_TYPES = {
    "apple",
    "stork",
    "tile_match",
    "pinball_ladder",
    "pace",
    "pattern",
    "pinpoint",
}

# Character sets supported by the frontend's mbtiEngine + personaData.
VALID_CHARACTER_SETS = {"pokemon", "digimon", "kakao_friends"}


# ── Big5 ──────────────────────────────────────────────────────────────────

@router.post("/big5", response_model=ResultCreatedResponse, status_code=status.HTTP_201_CREATED)
def submit_big5(
    req: Big5SubmitRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    required_keys = {"O", "C", "E", "A", "N"}
    if not required_keys.issubset(req.score_0_100.keys()):
        raise HTTPException(
            status_code=400,
            detail=f"score_0_100 must include keys {sorted(required_keys)}",
        )

    row = Big5Result(
        user_id=user.id,
        test_code=req.test_code,
        score_o=req.score_0_100["O"],
        score_c=req.score_0_100["C"],
        score_e=req.score_0_100["E"],
        score_a=req.score_0_100["A"],
        score_n=req.score_0_100["N"],
        answers=req.answers,
        lang=req.lang,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ResultCreatedResponse(id=row.id, created_at=row.created_at)


@router.get("/big5/me", response_model=List[Big5HistoryItem])
def my_big5(
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Big5Result)
        .filter(Big5Result.user_id == user.id)
        .order_by(Big5Result.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        Big5HistoryItem(
            id=r.id,
            test_code=r.test_code,
            score_o=float(r.score_o),
            score_c=float(r.score_c),
            score_e=float(r.score_e),
            score_a=float(r.score_a),
            score_n=float(r.score_n),
            lang=r.lang,
            created_at=r.created_at,
        )
        for r in rows
    ]


# ── MBTI ──────────────────────────────────────────────────────────────────

@router.post("/mbti", response_model=ResultCreatedResponse, status_code=status.HTTP_201_CREATED)
def submit_mbti(
    req: MbtiSubmitRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(req.mbti_type) != 4 or any(c not in "EISNTFJP" for c in req.mbti_type.upper()):
        raise HTTPException(status_code=400, detail="Invalid mbti_type")
    if req.character_set not in VALID_CHARACTER_SETS:
        raise HTTPException(
            status_code=400,
            detail=f"character_set must be one of {sorted(VALID_CHARACTER_SETS)}",
        )

    row = MbtiResult(
        user_id=user.id,
        test_code=req.test_code,
        mbti_type=req.mbti_type.upper(),
        scores=req.score_0_100,
        character_set=req.character_set,
        character_id=req.character_id,
        answers=req.answers,
        lang=req.lang,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ResultCreatedResponse(id=row.id, created_at=row.created_at)


@router.get("/mbti/me", response_model=List[MbtiHistoryItem])
def my_mbti(
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MbtiResult)
        .filter(MbtiResult.user_id == user.id)
        .order_by(MbtiResult.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        MbtiHistoryItem(
            id=r.id,
            test_code=r.test_code,
            mbti_type=r.mbti_type,
            scores=r.scores,
            character_set=r.character_set,
            character_id=r.character_id,
            lang=r.lang,
            created_at=r.created_at,
        )
        for r in rows
    ]


# ── Games ─────────────────────────────────────────────────────────────────

@router.post("/game", response_model=ResultCreatedResponse, status_code=status.HTTP_201_CREATED)
def submit_game_score(
    req: GameScoreSubmitRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.game_type not in VALID_GAME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"game_type must be one of {sorted(VALID_GAME_TYPES)}",
        )
    row = GameScore(user_id=user.id, game_type=req.game_type, score=req.score)
    db.add(row)
    db.commit()
    db.refresh(row)
    return ResultCreatedResponse(id=row.id, created_at=row.created_at)


@router.get("/game/me", response_model=List[GameBestItem])
def my_game_bests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # For each game_type I've played: best + play count.
    stmt = (
        select(
            GameScore.game_type,
            func.max(GameScore.score).label("best_score"),
            func.count(GameScore.id).label("play_count"),
        )
        .where(GameScore.user_id == user.id)
        .group_by(GameScore.game_type)
    )
    rows = db.execute(stmt).all()
    return [
        GameBestItem(
            game_type=r.game_type,
            best_score=int(r.best_score or 0),
            play_count=int(r.play_count or 0),
        )
        for r in rows
    ]
