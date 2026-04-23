import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import {
  TrendingUp, Users, Gamepad2, Sparkles, Trophy, Clock,
  ArrowRight, Crown, BarChart3 as BarIcon, RefreshCw,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useLangStore from '../store/langStore';
import usePopularStore from '../store/popularStore';
import { t } from '../i18n/texts';

// ── Meta / labels ────────────────────────────────────────────────────────

// Emojis mirror the Play tab's card art. Titles themselves come from the
// i18n dictionary (`play_{id}_title`) so Popular and Play always agree.
const GAME_EMOJI = {
  apple: '🍎',
  stork: '🕊️',
  tile_match: '🧩',
  pinball_ladder: '🎰',
  pace: '⚡',
  pattern: '🎮',
  pinpoint: '🌍',
};

const MBTI_TYPES_ORDER = [
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
];

function gameLabel(key, lang) {
  const emoji = GAME_EMOJI[key];
  const title = t(lang, `play_${key}_title`);
  // If the key isn't one we know, t() returns the key itself — fall back cleanly.
  if (!emoji) return title;
  return `${emoji} ${title}`;
}

// Stork's stored score IS distance in meters (see StorkGame.jsx DISTANCE_SCALE).
function formatGameScore(gameType, score) {
  if (gameType === 'stork') return `${score}m`;
  return String(score);
}

function birthDecadeLabel(year, lang) {
  if (!year) return '';
  const start = Math.floor(year / 10) * 10;
  return lang === 'kr' ? `${start}년대생` : `${start}s-born`;
}

// ── Sub-components ───────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children, subtitle, action }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-primary-600" />}
          <h3 className="font-bold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      {subtitle && <p className="text-xs text-gray-400 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

function EmptyCTA({ text, ctaText, onClick }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
      <p className="text-sm text-gray-400">{text}</p>
      <button onClick={onClick} className="btn-primary text-sm">
        {ctaText} <ArrowRight size={14} className="inline ml-1" />
      </button>
    </div>
  );
}

function MyMbtiCard({ mbti, lang, onRetake }) {
  const navigate = useNavigate();
  if (!mbti) {
    return (
      <SectionCard icon={Sparkles} title={t(lang, 'popular_my_mbti')}>
        <EmptyCTA
          text={t(lang, 'popular_my_mbti_none')}
          ctaText={t(lang, 'popular_take_mbti')}
          onClick={() => navigate('/persona')}
        />
      </SectionCard>
    );
  }

  const imgSrc = `./character_images/${mbti.character_set}/${mbti.character_id}.png`;
  return (
    <SectionCard
      icon={Sparkles}
      title={t(lang, 'popular_my_mbti')}
      action={
        <button onClick={onRetake} className="text-xs text-primary-600 hover:underline">
          {lang === 'kr' ? '다시 검사' : 'Retake'}
        </button>
      }
    >
      <div className="flex items-center gap-4">
        <img
          src={imgSrc}
          alt={mbti.character_id}
          className="w-24 h-24 object-contain rounded-xl bg-gray-50"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
        <div>
          <div className="text-3xl font-black text-primary-700 tracking-wider">
            {mbti.mbti_type}
          </div>
          <div className="text-sm text-gray-500 capitalize">
            {mbti.character_set.replace('_', ' ')} · {mbti.character_id}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(mbti.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function AgeMbtiDistribution({ dist, birthYear, lang }) {
  if (!dist || dist.total === 0) return null;

  // Fill out all 16 MBTI types so the chart is dense even when data is sparse.
  const byType = Object.fromEntries(dist.buckets.map((b) => [b.mbti_type, b]));
  const data = MBTI_TYPES_ORDER.map((t) => ({
    mbti: t,
    count: byType[t]?.count ?? 0,
    isMine: t === dist.my_type,
  }));

  const decadeLabel = birthDecadeLabel(birthYear, lang);
  const title = t(lang, 'popular_age_distribution').replace('{decade}', decadeLabel);
  const rankLine = dist.my_rank
    ? t(lang, 'popular_rank_in_age').replace('{rank}', dist.my_rank)
    : null;

  return (
    <SectionCard icon={BarIcon} title={title} subtitle={rankLine}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
          <XAxis dataKey="mbti" tick={{ fontSize: 10 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip
            cursor={{ fill: '#f3f4f6' }}
            formatter={(v) => [v, lang === 'kr' ? '명' : 'count']}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.mbti} fill={d.isMine ? '#7c3aed' : '#c4b5fd'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2">
        {lang === 'kr' ? '총' : 'Total'} {dist.total}{lang === 'kr' ? '명' : ' users'}
      </p>
    </SectionCard>
  );
}

function Big5Compare({ latest, ageAvg, lang }) {
  const navigate = useNavigate();
  if (!latest) {
    return (
      <SectionCard icon={BarIcon} title={t(lang, 'popular_big5_compare')}>
        <EmptyCTA
          text={t(lang, 'popular_big5_none')}
          ctaText={t(lang, 'popular_take_mbti')}
          onClick={() => navigate('/personality')}
        />
      </SectionCard>
    );
  }

  const labels = {
    O: lang === 'kr' ? '개방성' : 'Openness',
    C: lang === 'kr' ? '성실성' : 'Conscientiousness',
    E: lang === 'kr' ? '외향성' : 'Extraversion',
    A: lang === 'kr' ? '우호성' : 'Agreeableness',
    N: lang === 'kr' ? '신경성' : 'Neuroticism',
  };

  const data = ['O', 'C', 'E', 'A', 'N'].map((k) => ({
    axis: labels[k],
    me: Number(latest[`score_${k.toLowerCase()}`] || 0),
    avg: ageAvg ? Number(ageAvg[k] || 0) : null,
  }));

  return (
    <SectionCard icon={BarIcon} title={t(lang, 'popular_big5_compare')}>
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar name={lang === 'kr' ? '나' : 'Me'} dataKey="me" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.35} />
          {ageAvg && (
            <Radar name={lang === 'kr' ? '동년대 평균' : 'Age avg'} dataKey="avg" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} />
          )}
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

function TimelineList({ items, lang }) {
  if (!items || items.length === 0) {
    return (
      <SectionCard icon={Clock} title={t(lang, 'popular_timeline')}>
        <p className="text-sm text-gray-400 text-center py-4">
          {t(lang, 'popular_timeline_empty')}
        </p>
      </SectionCard>
    );
  }

  const render = (item) => {
    const when = new Date(item.created_at).toLocaleString();
    if (item.kind === 'game') {
      const [gtype, score] = item.summary.split(':');
      return `${gameLabel(gtype, lang)} — ${formatGameScore(gtype, score)}`;
    }
    if (item.kind === 'mbti') {
      return `MBTI · ${item.summary}`;
    }
    return `Big5 · ${item.summary}`;
  };

  return (
    <SectionCard icon={Clock} title={t(lang, 'popular_timeline')}>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={`${i.kind}-${i.id}`} className="flex items-center justify-between text-sm">
            <span className="text-gray-700 truncate">{render(i)}</span>
            <span className="text-xs text-gray-400 shrink-0 ml-2">
              {new Date(i.created_at).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function TrendsCard({ trends, lang }) {
  if (!trends) return null;

  return (
    <SectionCard icon={TrendingUp} title={t(lang, 'popular_trends_title')}>
      <div className="space-y-4">
        {/* Top MBTI */}
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            <Sparkles size={12} /> {t(lang, 'popular_top_mbti')}
          </div>
          {trends.top_mbti.length === 0 ? (
            <p className="text-xs text-gray-400">—</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {trends.top_mbti.map((b, i) => (
                <span
                  key={b.key}
                  className={`px-2 py-1 rounded-md text-xs font-medium ${
                    i === 0 ? 'bg-purple-100 text-purple-800'
                    : i === 1 ? 'bg-purple-50 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {i + 1}. {b.label} · {b.count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Top Games */}
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            <Gamepad2 size={12} /> {t(lang, 'popular_top_games')}
          </div>
          {trends.top_games.length === 0 ? (
            <p className="text-xs text-gray-400">—</p>
          ) : (
            <ul className="space-y-1">
              {trends.top_games.map((b, i) => (
                <li key={b.key} className="flex justify-between text-sm">
                  <span>
                    <span className="text-xs text-gray-400 w-4 inline-block">{i + 1}.</span>{' '}
                    {gameLabel(b.key, lang)}
                  </span>
                  <span className="text-xs text-gray-500">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* User counts */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-gray-400">{t(lang, 'popular_new_users')}</div>
            <div className="text-lg font-bold text-primary-700">{trends.new_users_7d}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">{t(lang, 'popular_total_users')}</div>
            <div className="text-lg font-bold text-gray-700">{trends.total_users}</div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function LeaderboardCard({ boards, lang }) {
  if (!boards) return null;

  return (
    <SectionCard icon={Trophy} title={t(lang, 'popular_leaderboards')}>
      <div className="space-y-4">
        {boards.map((lb) => (
          <div key={lb.game_type}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold">
                {gameLabel(lb.game_type, lang)}
              </span>
              <span className="text-xs text-gray-400">
                {lb.total_players} {lang === 'kr' ? '명' : 'players'}
              </span>
            </div>

            {lb.top.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">{t(lang, 'popular_no_players')}</p>
            ) : (
              <ol className="space-y-0.5">
                {lb.top.slice(0, 5).map((row) => (
                  <li
                    key={`${lb.game_type}-${row.rank}-${row.display_name}`}
                    className={`flex items-center justify-between text-sm px-2 py-1 rounded-md ${
                      row.is_me ? 'bg-primary-50 text-primary-800 font-semibold' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {row.rank === 1 && <Crown size={12} className="text-yellow-500 shrink-0" />}
                      <span className="text-xs text-gray-400 w-5">{row.rank}.</span>
                      <span className="truncate">{row.display_name}</span>
                    </span>
                    <span className="text-xs tabular-nums">{formatGameScore(lb.game_type, row.best_score)}</span>
                  </li>
                ))}
                {lb.me && (
                  <li className="flex items-center justify-between text-sm px-2 py-1 rounded-md bg-primary-50 text-primary-800 font-semibold mt-1 border-t border-primary-100">
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-xs text-gray-400 w-5">{lb.me.rank}.</span>
                      <span className="truncate">{lb.me.display_name} ({t(lang, 'popular_my_rank')})</span>
                    </span>
                    <span className="text-xs tabular-nums">{formatGameScore(lb.game_type, lb.me.best_score)}</span>
                  </li>
                )}
              </ol>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Main page ────────────────────────────────────────────────────────────

export default function PopularPage() {
  const user = useAuthStore((s) => s.user);
  const { lang } = useLangStore();
  const navigate = useNavigate();

  const {
    dashboard, trends, leaderboards,
    loading, refreshing, fetchedAt, fetch,
  } = usePopularStore();

  // Always refresh on mount (including tab re-entry). Cached data stays
  // visible during the re-fetch so the UI never blanks out.
  useEffect(() => { fetch(); }, [fetch]);

  const decadeLabel = user ? birthDecadeLabel(user.birth_year, lang) : '';
  const fetchedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString()
    : null;

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">{t(lang, 'popular_title')}</h2>
          <p className="text-sm text-gray-500">
            {t(lang, 'popular_subtitle')}
            {user && <span className="text-gray-400"> · {decadeLabel}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fetchedLabel && !loading && (
            <span className="text-xs text-gray-400">
              {lang === 'kr' ? '업데이트' : 'Updated'} {fetchedLabel}
            </span>
          )}
          <button
            onClick={() => fetch({ force: true })}
            disabled={loading || refreshing}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-400 transition-colors disabled:opacity-50"
            title={lang === 'kr' ? '새로고침' : 'Refresh'}
          >
            <RefreshCw size={14} className={refreshing || loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2-column layout: left = personal, right = community */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT */}
        <div className="space-y-4">
          <MyMbtiCard
            mbti={dashboard?.latest_mbti}
            lang={lang}
            onRetake={() => navigate('/persona')}
          />
          <AgeMbtiDistribution
            dist={dashboard?.age_mbti_distribution}
            birthYear={user?.birth_year}
            lang={lang}
          />
          <Big5Compare
            latest={dashboard?.latest_big5}
            ageAvg={dashboard?.age_big5_average}
            lang={lang}
          />
          <TimelineList items={dashboard?.timeline} lang={lang} />
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <TrendsCard trends={trends} lang={lang} />
          <LeaderboardCard boards={leaderboards} lang={lang} />
        </div>
      </div>
    </div>
  );
}
