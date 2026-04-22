"""Demo-data seeder.

Behaviour is controlled by the SEED_DEMO_DATA env var:
    SEED_DEMO_DATA=true   → on startup, seed if demo users are missing
    SEED_DEMO_DATA=false  → on startup, purge any existing demo users
    (unset)               → no-op

CLI:
    python -m backend.seed seed [--users N]
    python -m backend.seed purge

Demo users are distinguished from real users by having an email on
@ryanpp.local (a reserved TLD that cannot be registered) so purge is
always safe — it never touches real accounts.
"""
from __future__ import annotations

import argparse
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.db import SessionLocal
from backend.models import Big5Result, GameScore, MbtiResult, User
from backend.security import hash_password

DEMO_EMAIL_DOMAIN = "ryanpp.local"

# 2023 Korean MBTI distribution. Source: testmoa.com (N=104,484, self-administered
# MBTI tests collected Mar-Aug 2023). Percentages sum to ~99% — rounding only.
# This data skews toward types common among online-test-takers in Korea's
# 1990s-2000s birth cohort, which matches our target audience.
KOREAN_MBTI_DISTRIBUTION = {
    "ISFJ": 9.08, "ISTJ": 8.89, "INFP": 8.07, "INFJ": 7.68,
    "ENFP": 7.36, "ISFP": 7.13, "ENFJ": 6.61, "ESFJ": 6.31,
    "ESTJ": 6.11, "INTJ": 5.97, "ISTP": 5.37, "ESFP": 5.21,
    "INTP": 4.92, "ENTJ": 4.87, "ENTP": 3.61, "ESTP": 2.81,
}

# Mirrors src/lib/personaData.js. Keep in sync when the frontend mapping changes.
CHARACTER_MAP = {
    "pokemon": {
        "ISTJ": "blastoise", "ISFJ": "bulbasaur", "INFJ": "mew", "INTJ": "mewtwo",
        "ISTP": "charizard", "ISFP": "snorlax", "INFP": "ditto", "INTP": "porygon",
        "ESTP": "squirtle", "ESFP": "pikachu", "ENFP": "eevee", "ENTP": "meowth",
        "ESTJ": "arcanine", "ESFJ": "charmander", "ENFJ": "dragonite", "ENTJ": "jigglypuff",
    },
    "digimon": {
        "ISTJ": "gabumon", "ISFJ": "biyomon", "INFJ": "angemon", "INTJ": "myotismon",
        "ISTP": "wargreymon", "ISFP": "gomamon", "INFP": "patamon", "INTP": "tentomon",
        "ESTP": "veemon", "ESFP": "palmon", "ENFP": "agumon", "ENTP": "demi_devimon",
        "ESTJ": "andromon", "ESFJ": "garurumon", "ENFJ": "leomon", "ENTJ": "omnimon",
    },
    "kakao_friends": {
        "INTJ": "scarpy", "INTP": "almond", "ENTJ": "neo", "ENTP": "panda_junior",
        "INFJ": "con", "INFP": "boksimi", "ENFJ": "jay_g", "ENFP": "muzi",
        "ISTJ": "jordi", "ISTP": "tube", "ESTJ": "kob", "ESTP": "kero_veroni",
        "ISFJ": "ryan", "ISFP": "choonsik", "ESFJ": "frodo", "ESFP": "apeach",
    },
}

# Mix of plausible Korean given names, friend names, and casual nicknames.
NICKNAMES = [
    "민지", "서연", "지호", "도윤", "하준", "수빈", "예준", "시우", "채원", "유나",
    "다은", "지우", "윤서", "지아", "유진", "하윤", "서준", "지훈", "건우", "민준",
    "예린", "수아", "서윤", "지원", "주원", "은우", "민재", "태윤", "현우", "승민",
    "라이언", "춘식이", "무지", "네오", "어피치", "프로도",
    "Ryan", "Luna", "Jay", "Max", "Lily", "Leo", "Mia", "Ben", "Sam", "Zoe",
    "달토끼", "해돋이", "별빛", "바람", "구름", "노을", "햇살", "모카", "라떼",
    "카푸치노", "아메리카노",
]

# Per-game score range: (min, mode, max). Used by random.triangular — skews toward
# the mode like real score distributions (most players middling, a few elite).
GAME_PROFILES = {
    "apple":      (30,  180, 800),
    "stork":      (5,   40,  250),
    "tile_match": (1,   8,   40),
    "pace":       (180, 280, 600),   # ms reaction time (lower = better)
    "pattern":    (1,   7,   25),
    "pinpoint":   (1,   8,   30),
    # pinball_ladder: no score — excluded.
}


def seed_is_enabled() -> Optional[bool]:
    """Returns True/False when the env var is set to a recognized value, else None."""
    val = os.getenv("SEED_DEMO_DATA", "").strip().lower()
    if val in ("true", "1", "yes", "on"):
        return True
    if val in ("false", "0", "no", "off"):
        return False
    return None


# Bcrypt is deliberately slow. Compute the demo hash once and reuse — demo users
# never log in anyway.
_DEMO_PASSWORD_HASH: Optional[str] = None


def _demo_hash() -> str:
    global _DEMO_PASSWORD_HASH
    if _DEMO_PASSWORD_HASH is None:
        _DEMO_PASSWORD_HASH = hash_password("locked-demo-user-no-login-4d2")
    return _DEMO_PASSWORD_HASH


def _weighted_mbti(rng: random.Random) -> str:
    types = list(KOREAN_MBTI_DISTRIBUTION.keys())
    weights = list(KOREAN_MBTI_DISTRIBUTION.values())
    return rng.choices(types, weights=weights, k=1)[0]


def _sample_big5(rng: random.Random) -> dict:
    def clip(v: float) -> float:
        return max(0.0, min(100.0, v))
    return {
        "O": round(clip(rng.gauss(62, 15)), 2),
        "C": round(clip(rng.gauss(54, 15)), 2),
        "E": round(clip(rng.gauss(50, 18)), 2),
        "A": round(clip(rng.gauss(60, 14)), 2),
        "N": round(clip(rng.gauss(52, 17)), 2),
    }


def _sample_mbti_axis_scores(rng: random.Random, mbti_type: str) -> dict:
    """Generate 8-axis 0–100 scores consistent with the given 4-letter MBTI."""
    scores = {}
    for winner_candidates in [("E", "I"), ("S", "N"), ("T", "F"), ("J", "P")]:
        a, b = winner_candidates
        winner = a if a in mbti_type else b
        loser = b if winner == a else a
        w = round(rng.uniform(55, 82), 2)
        l = round(max(15.0, min(60.0, 100 - w + rng.uniform(-12, 12))), 2)
        scores[winner] = w
        scores[loser] = l
    return scores


def _sample_game_score(rng: random.Random, game_type: str) -> int:
    lo, mode, hi = GAME_PROFILES[game_type]
    return int(round(rng.triangular(lo, hi, mode)))


def seed(db: Session, n_users: int = 80, seed_val: int = 42) -> int:
    existing = (
        db.query(User)
        .filter(User.email.like(f"%@{DEMO_EMAIL_DOMAIN}"))
        .count()
    )
    if existing > 0:
        print(f"[seed] {existing} demo users already exist — skipping")
        return 0

    rng = random.Random(seed_val)
    demo_hash = _demo_hash()
    now = datetime.now(timezone.utc)

    # Users
    users: list[User] = []
    for i in range(n_users):
        nickname = rng.choice(NICKNAMES)
        birth_year = rng.randint(1990, 2005)
        created_at = now - timedelta(
            days=rng.randint(0, 30),
            hours=rng.randint(0, 23),
            minutes=rng.randint(0, 59),
        )
        u = User(
            email=f"demo_{i:03d}@{DEMO_EMAIL_DOMAIN}",
            password_hash=demo_hash,
            display_name=nickname,
            birth_year=birth_year,
            created_at=created_at,
        )
        db.add(u)
        users.append(u)
    db.flush()

    # One MBTI result per user, weighted by Korean distribution.
    for u in users:
        mbti = _weighted_mbti(rng)
        char_set = rng.choice(list(CHARACTER_MAP.keys()))
        db.add(MbtiResult(
            user_id=u.id,
            test_code="mbti_v1",
            mbti_type=mbti,
            scores=_sample_mbti_axis_scores(rng, mbti),
            character_set=char_set,
            character_id=CHARACTER_MAP[char_set][mbti],
            answers={},
            lang="kr",
            created_at=u.created_at + timedelta(minutes=rng.randint(1, 60)),
        ))

    # Big5 for ~70% of users.
    for u in users:
        if rng.random() > 0.7:
            continue
        s = _sample_big5(rng)
        db.add(Big5Result(
            user_id=u.id,
            test_code="big5_v1",
            score_o=s["O"], score_c=s["C"], score_e=s["E"],
            score_a=s["A"], score_n=s["N"],
            answers={},
            lang="kr",
            created_at=u.created_at + timedelta(minutes=rng.randint(10, 180)),
        ))

    # 2–5 game sessions per user across random games.
    game_types = list(GAME_PROFILES.keys())
    for u in users:
        for _ in range(rng.randint(2, 5)):
            gt = rng.choice(game_types)
            db.add(GameScore(
                user_id=u.id,
                game_type=gt,
                score=_sample_game_score(rng, gt),
                created_at=u.created_at + timedelta(hours=rng.randint(0, 168)),
            ))

    db.commit()
    print(f"[seed] created {n_users} demo users + results")
    return n_users


def purge(db: Session) -> int:
    # Foreign keys cascade, so deleting users clears their results/scores.
    result = db.execute(
        text("DELETE FROM users WHERE email LIKE :pat"),
        {"pat": f"%@{DEMO_EMAIL_DOMAIN}"},
    )
    deleted = result.rowcount or 0
    db.commit()
    print(f"[seed] purged {deleted} demo users")
    return deleted


def sync_from_env() -> None:
    """Call on app startup. Acts on SEED_DEMO_DATA env var; no-op if unset."""
    decision = seed_is_enabled()
    if decision is None:
        return
    db = SessionLocal()
    try:
        if decision:
            seed(db)
        else:
            purge(db)
    except Exception as e:
        # Never let a seed error block app startup.
        print(f"[seed] error: {e}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed or purge demo data.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sp_seed = sub.add_parser("seed", help="Create demo users and results")
    sp_seed.add_argument("--users", type=int, default=80)
    sp_seed.add_argument("--random", action="store_true", help="Non-deterministic sampling")
    sub.add_parser("purge", help="Delete all demo users (and their data)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.cmd == "seed":
            seed_val = random.randint(0, 10_000) if args.random else 42
            seed(db, n_users=args.users, seed_val=seed_val)
        elif args.cmd == "purge":
            purge(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
