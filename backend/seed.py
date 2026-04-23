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

# Nicknames are drawn from three pools to mimic the real 90s-born audience
# this service targets. Ratio (implemented in _make_nickname):
#   50%  real name + birth-year suffix  (지훈95, yujin99)
#   20%  real name only                  (지훈, 수진)
#   30%  witty self-aware handles        (집가고싶다, 라이언말고춘식이)
#
# Real-name pools use top Korean given names among 1990s-born cohort
# (행정안전부 신생아 통계 기반). Current popular names like "도윤/하윤/서연"
# are deliberately excluded — they skew 2005–2015 births.

NAMES_KR_MALE_90S = [
    "지훈", "민수", "성민", "동현", "현우", "민호", "민재", "진우", "준호", "정훈",
    "재영", "영훈", "상훈", "승현", "승준", "종현", "재현", "태현", "병훈", "기훈",
    "정민", "준영", "재성", "태훈", "민규", "진영", "승민", "용준", "진호", "성호",
]

NAMES_KR_FEMALE_90S = [
    "지혜", "수진", "은영", "은정", "지은", "민지", "유진", "예진", "현정", "지영",
    "혜진", "주연", "혜원", "소영", "미정", "지현", "지수", "유리", "민정", "보람",
    "은주", "수빈", "정은", "수연", "미진", "아름", "가영", "은지", "유정", "영주",
]

# Romanizations — kept lowercase to match typical ID-style writing.
NAMES_EN_MALE_90S = [
    "jihun", "minsu", "sungmin", "donghyun", "hyunwoo", "minho", "minjae",
    "junho", "junyoung", "sunghyun", "jaehyun", "taehyun", "jinwoo",
]

NAMES_EN_FEMALE_90S = [
    "jihye", "sujin", "eunyoung", "jieun", "minji", "yujin", "yejin",
    "hyunjung", "jiyoung", "hyejin", "juyeon", "soyoung", "jihyun", "jisoo",
    "yuri", "boram", "suyeon", "gayoung", "eunji",
]

WITTY_NICKNAMES = [
    # 직장인/현생 자조
    "집가고싶다", "퇴근하고싶다", "월요일싫어", "내일은공휴일", "오늘도야근",
    "주말까지3일", "아무것도안하고싶다", "다이어트는내일부터", "회식싫어",
    "이번생은망했어", "다음생엔부자", "영혼을팔아서", "사표쓰고싶다",
    "월급날기다려", "로또1등가자", "통장이비어있어", "카페인없이못삼", "아아한잔해요",
    # 장난/도발
    "너는누구냐", "나는누구여긴어디", "다들뭐해요", "누구세요", "왜보세요", "관심없어요",
    # 카카오프렌즈 패러디
    "라이언말고춘식이", "춘식이가최고", "무지는바나나", "어피치는복숭아",
    "네오가나보다잘생김", "프로도랑결혼할래",
    # 90년대생 추억
    "HOT팬클럽", "젝키vs핑클", "세일러문변신", "추억의둘리", "포켓몬마스터",
    "디지몬어드벤처", "삐삐치는중", "버디버디추억", "싸이월드감성",
    # 음식/일상
    "치킨시켜줘", "라면먹고갈래", "김치찌개한그릇", "배고파요", "잠만잘래",
    "졸려요", "내일뭐먹지", "점심메뉴추천",
]

# Suffixes concentrated on 1990s but a few 00/01s for variety (카카오 가입 초기
# ID를 만든 연도 등). Avoiding exact birth-year correlation intentionally so the
# demo data doesn't look over-engineered.
NAME_SUFFIXES = ["90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "00", "01"]


def _make_nickname(rng: random.Random) -> str:
    r = rng.random()
    if r < 0.50:
        # 실명 + 출생년도 2자리. 약 30%는 영문 표기로 섞어 현실감을 살림.
        if rng.random() < 0.3:
            base = rng.choice(NAMES_EN_MALE_90S + NAMES_EN_FEMALE_90S)
        else:
            base = rng.choice(NAMES_KR_MALE_90S + NAMES_KR_FEMALE_90S)
        return f"{base}{rng.choice(NAME_SUFFIXES)}"
    if r < 0.70:
        return rng.choice(NAMES_KR_MALE_90S + NAMES_KR_FEMALE_90S)
    return rng.choice(WITTY_NICKNAMES)

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
        nickname = _make_nickname(rng)
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
