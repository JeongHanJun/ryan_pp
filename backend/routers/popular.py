from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.deps import get_current_user, get_current_user_optional
from backend.models import User
from backend.schemas import (
    Big5HistoryItem,
    GameLeaderboard,
    GameLeaderboardItem,
    MbtiDistribution,
    MbtiDistributionBucket,
    MbtiHistoryItem,
    PopularMeResponse,
    PopularTrends,
    TimelineItem,
    TrendBucket,
)

router = APIRouter(prefix="/api/popular", tags=["popular"])


def _decade_bucket(birth_year: int) -> tuple[int, int]:
    """1995 → (1990, 1999). 10-year birth-year bucket for 'age bracket' stats."""
    start = (birth_year // 10) * 10
    return start, start + 9


def _mbti_distribution(db: Session, lo: int, hi: int, my_type: Optional[str]) -> Optional[MbtiDistribution]:
    rows = db.execute(
        text(
            """
            WITH latest AS (
                SELECT DISTINCT ON (user_id) user_id, mbti_type
                FROM mbti_results
                ORDER BY user_id, created_at DESC
            )
            SELECT l.mbti_type, COUNT(*) AS cnt
            FROM latest l
            JOIN users u ON u.id = l.user_id
            WHERE u.birth_year BETWEEN :lo AND :hi
            GROUP BY l.mbti_type
            ORDER BY cnt DESC, l.mbti_type
            """
        ),
        {"lo": lo, "hi": hi},
    ).all()

    if not rows:
        return None

    total = sum(int(r.cnt) for r in rows)
    buckets = [
        MbtiDistributionBucket(
            mbti_type=r.mbti_type,
            count=int(r.cnt),
            ratio=round(int(r.cnt) / total, 4) if total else 0.0,
        )
        for r in rows
    ]
    my_rank: Optional[int] = None
    if my_type:
        for i, b in enumerate(buckets, start=1):
            if b.mbti_type == my_type:
                my_rank = i
                break
    return MbtiDistribution(total=total, buckets=buckets, my_type=my_type, my_rank=my_rank)


def _big5_avg(db: Session, lo: int, hi: int) -> Optional[dict]:
    row = db.execute(
        text(
            """
            WITH latest AS (
                SELECT DISTINCT ON (user_id)
                    user_id, score_o, score_c, score_e, score_a, score_n
                FROM big5_results
                ORDER BY user_id, created_at DESC
            )
            SELECT
                AVG(l.score_o)::float AS avg_o,
                AVG(l.score_c)::float AS avg_c,
                AVG(l.score_e)::float AS avg_e,
                AVG(l.score_a)::float AS avg_a,
                AVG(l.score_n)::float AS avg_n,
                COUNT(*) AS cnt
            FROM latest l
            JOIN users u ON u.id = l.user_id
            WHERE u.birth_year BETWEEN :lo AND :hi
            """
        ),
        {"lo": lo, "hi": hi},
    ).one()

    if not row.cnt:
        return None
    return {
        "O": round(row.avg_o or 0.0, 2),
        "C": round(row.avg_c or 0.0, 2),
        "E": round(row.avg_e or 0.0, 2),
        "A": round(row.avg_a or 0.0, 2),
        "N": round(row.avg_n or 0.0, 2),
        "_sample_size": int(row.cnt),
    }


def _latest_mbti(db: Session, user_id: int) -> Optional[MbtiHistoryItem]:
    row = db.execute(
        text(
            """
            SELECT id, test_code, mbti_type, scores,
                   character_set, character_id, lang, created_at
            FROM mbti_results
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"uid": user_id},
    ).one_or_none()
    if not row:
        return None
    return MbtiHistoryItem(
        id=row.id,
        test_code=row.test_code,
        mbti_type=row.mbti_type,
        scores=row.scores,
        character_set=row.character_set,
        character_id=row.character_id,
        lang=row.lang,
        created_at=row.created_at,
    )


def _latest_big5(db: Session, user_id: int) -> Optional[Big5HistoryItem]:
    row = db.execute(
        text(
            """
            SELECT id, test_code, score_o, score_c, score_e, score_a, score_n,
                   lang, created_at
            FROM big5_results
            WHERE user_id = :uid
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"uid": user_id},
    ).one_or_none()
    if not row:
        return None
    return Big5HistoryItem(
        id=row.id,
        test_code=row.test_code,
        score_o=float(row.score_o),
        score_c=float(row.score_c),
        score_e=float(row.score_e),
        score_a=float(row.score_a),
        score_n=float(row.score_n),
        lang=row.lang,
        created_at=row.created_at,
    )


def _timeline(db: Session, user_id: int, limit: int = 10) -> list[TimelineItem]:
    rows = db.execute(
        text(
            """
            (SELECT 'big5' AS kind, id, test_code AS summary, created_at
             FROM big5_results WHERE user_id = :uid)
            UNION ALL
            (SELECT 'mbti' AS kind, id, mbti_type AS summary, created_at
             FROM mbti_results WHERE user_id = :uid)
            UNION ALL
            (SELECT 'game' AS kind, id,
                    game_type || ':' || score::text AS summary, created_at
             FROM game_scores WHERE user_id = :uid)
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {"uid": user_id, "limit": limit},
    ).all()
    return [
        TimelineItem(
            kind=r.kind, id=r.id, summary=r.summary, created_at=r.created_at
        )
        for r in rows
    ]


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=PopularMeResponse)
def popular_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    latest_mbti = _latest_mbti(db, user.id)
    latest_big5 = _latest_big5(db, user.id)
    lo, hi = _decade_bucket(user.birth_year)

    return PopularMeResponse(
        latest_mbti=latest_mbti,
        latest_big5=latest_big5,
        age_mbti_distribution=_mbti_distribution(
            db, lo, hi, my_type=latest_mbti.mbti_type if latest_mbti else None
        ),
        age_big5_average=_big5_avg(db, lo, hi),
        timeline=_timeline(db, user.id),
    )


@router.get("/trends", response_model=PopularTrends)
def popular_trends(
    window_days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    top_mbti_rows = db.execute(
        text(
            """
            SELECT mbti_type AS key, COUNT(*) AS cnt
            FROM mbti_results
            WHERE created_at >= now() - make_interval(days => :days)
            GROUP BY mbti_type
            ORDER BY cnt DESC, mbti_type
            LIMIT 5
            """
        ),
        {"days": window_days},
    ).all()

    top_game_rows = db.execute(
        text(
            """
            SELECT game_type AS key, COUNT(*) AS cnt
            FROM game_scores
            WHERE created_at >= now() - make_interval(days => :days)
            GROUP BY game_type
            ORDER BY cnt DESC, game_type
            LIMIT 5
            """
        ),
        {"days": window_days},
    ).all()

    new_users = db.execute(
        text(
            "SELECT COUNT(*) AS cnt FROM users WHERE created_at >= now() - make_interval(days => :days)"
        ),
        {"days": window_days},
    ).scalar_one()

    total_users = db.execute(text("SELECT COUNT(*) FROM users")).scalar_one()

    return PopularTrends(
        window_days=window_days,
        top_mbti=[TrendBucket(key=r.key, label=r.key, count=int(r.cnt)) for r in top_mbti_rows],
        top_games=[TrendBucket(key=r.key, label=r.key, count=int(r.cnt)) for r in top_game_rows],
        new_users_7d=int(new_users or 0),
        total_users=int(total_users or 0),
    )


@router.get("/leaderboards", response_model=list[GameLeaderboard])
def popular_leaderboards(
    top_n: int = Query(10, ge=1, le=50),
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """All games in 3 queries total (top-N, totals, my-rank) instead of 3×N_games."""
    from backend.routers.results import VALID_GAME_TYPES

    my_id = user.id if user else None

    # Top-N per game, ranked by max score per user.
    top_rows = db.execute(
        text(
            """
            WITH bests AS (
                SELECT game_type, user_id, MAX(score) AS best_score
                FROM game_scores
                GROUP BY game_type, user_id
            ),
            ranked AS (
                SELECT game_type, user_id, best_score,
                       RANK() OVER (PARTITION BY game_type ORDER BY best_score DESC) AS rnk
                FROM bests
            )
            SELECT r.game_type, r.user_id, u.display_name, r.best_score, r.rnk
            FROM ranked r
            JOIN users u ON u.id = r.user_id
            WHERE r.rnk <= :n
            ORDER BY r.game_type, r.rnk, u.display_name
            """
        ),
        {"n": top_n},
    ).all()

    # Distinct-player count per game.
    total_rows = db.execute(
        text(
            """
            SELECT game_type, COUNT(DISTINCT user_id) AS total_players
            FROM game_scores
            GROUP BY game_type
            """
        )
    ).all()
    totals = {r.game_type: int(r.total_players) for r in total_rows}

    # My rank per game (only if logged in).
    my_ranks: dict[str, tuple[int, int]] = {}
    if my_id is not None:
        my_rows = db.execute(
            text(
                """
                WITH bests AS (
                    SELECT game_type, user_id, MAX(score) AS best_score
                    FROM game_scores
                    GROUP BY game_type, user_id
                ),
                ranked AS (
                    SELECT game_type, user_id, best_score,
                           RANK() OVER (PARTITION BY game_type ORDER BY best_score DESC) AS rnk
                    FROM bests
                )
                SELECT game_type, best_score, rnk
                FROM ranked
                WHERE user_id = :uid
                """
            ),
            {"uid": my_id},
        ).all()
        my_ranks = {r.game_type: (int(r.rnk), int(r.best_score)) for r in my_rows}

    # Group top rows by game_type.
    per_game: dict[str, list] = {gt: [] for gt in VALID_GAME_TYPES}
    for r in top_rows:
        if r.game_type not in per_game:
            continue
        per_game[r.game_type].append(
            GameLeaderboardItem(
                rank=int(r.rnk),
                display_name=r.display_name,
                best_score=int(r.best_score),
                is_me=(my_id is not None and r.user_id == my_id),
            )
        )

    out: list[GameLeaderboard] = []
    my_display = user.display_name if user else ""
    for game_type in sorted(VALID_GAME_TYPES):
        top = per_game.get(game_type, [])
        me_item: Optional[GameLeaderboardItem] = None
        if my_id is not None and game_type in my_ranks and not any(i.is_me for i in top):
            rnk, best_score = my_ranks[game_type]
            me_item = GameLeaderboardItem(
                rank=rnk,
                display_name=my_display,
                best_score=best_score,
                is_me=True,
            )
        out.append(
            GameLeaderboard(
                game_type=game_type,
                total_players=totals.get(game_type, 0),
                top=top,
                me=me_item,
            )
        )
    return out
