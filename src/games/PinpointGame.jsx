import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const GEO_URL = './data/world-atlas.json';
const ROUNDS = 10;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
}

function calcScore(dist) {
  return Math.max(0, Math.round(5000 * Math.exp(-dist / 1500)));
}

function getGrade(pct, kr) {
  if (pct >= 80) return kr ? '🌟 지리 천재' : '🌟 Geography Genius';
  if (pct >= 60) return kr ? '🗺️ 지도 박사' : '🗺️ Map Expert';
  if (pct >= 40) return kr ? '✈️ 여행가' : '✈️ Traveler';
  return kr ? '📍 지구인' : '📍 Earthling';
}

export default function PinpointGame({ onGameEnd, lang = 'kr' }) {
  const [countries, setCountries] = useState([]);
  const [round, setRound]         = useState(0);
  const [target, setTarget]       = useState(null);
  const [selected, setSelected]   = useState(null);
  const [results, setResults]     = useState([]);
  const [phase, setPhase]         = useState('idle');
  const [totalScore, setTotal]    = useState(0);
  const kr = lang === 'kr';

  useEffect(() => {
    fetch('./data/pinpoint_countries.json')
      .then(r => r.json())
      .then(setCountries);
  }, []);

  const pick = (usedIds = []) => {
    const pool = countries.filter(c => !usedIds.includes(c.id));
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const start = () => {
    const t = pick();
    setTarget(t);
    setRound(0);
    setResults([]);
    setTotal(0);
    setSelected(null);
    setPhase('playing');
  };

  const handleMarker = (country) => {
    if (phase !== 'playing') return;
    setSelected(country);
    const dist = haversine(target.lat, target.lng, country.lat, country.lng);
    const pts  = calcScore(dist);
    const res  = { target, selected: country, dist, pts };
    setResults(prev => [...prev, res]);
    setTotal(s => s + pts);
    setPhase('reveal');
  };

  const next = () => {
    const nr = round + 1;
    if (nr >= ROUNDS) {
      setPhase('finished');
      if (onGameEnd) onGameEnd(totalScore);
      return;
    }
    const used = results.map(r => r.target.id);
    if (target) used.push(target.id);
    const t = pick(used);
    setTarget(t);
    setSelected(null);
    setRound(nr);
    setPhase('playing');
  };

  const reset = () => {
    setPhase('idle');
    setRound(0);
    setTarget(null);
    setSelected(null);
    setResults([]);
    setTotal(0);
  };

  const last = results[results.length - 1];

  // Idle
  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <div className="text-6xl">🌍</div>
        <h3 className="text-xl font-bold text-gray-700">{kr ? '세계 지도 퀴즈' : 'World Map Quiz'}</h3>
        <p className="text-gray-500 text-sm text-center max-w-sm">
          {kr
            ? '국가 이름이 주어지면 지도에서 해당 나라 위치를 클릭하세요.\n가까울수록 높은 점수!'
            : 'Find the country on the map.\nCloser = more points!'}
        </p>
        <p className="text-xs text-gray-400">{ROUNDS}{kr ? '문제 · 최고 ' : ' rounds · Max '}{(ROUNDS * 5000).toLocaleString()}{kr ? '점' : ' pts'}</p>
        <button
          onClick={start}
          disabled={countries.length === 0}
          className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
        >
          {countries.length === 0 ? (kr ? '로딩 중...' : 'Loading...') : (kr ? '시작하기' : 'Start')}
        </button>
      </div>
    );
  }

  // Finished
  if (phase === 'finished') {
    const maxScore = ROUNDS * 5000;
    const pct   = Math.round((totalScore / maxScore) * 100);
    const grade = getGrade(pct, kr);
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="text-5xl">{grade.split(' ')[0]}</div>
        <div className="bg-white rounded-2xl shadow p-6 text-center w-full max-w-sm">
          <p className="text-gray-400 text-sm mb-1">{kr ? '총 점수' : 'Total Score'}</p>
          <p className="text-4xl font-bold text-emerald-600">
            {totalScore.toLocaleString()}
            <span className="text-xl text-gray-300">/{maxScore.toLocaleString()}</span>
          </p>
          <p className="mt-2 text-lg font-semibold text-gray-700">{grade}</p>
        </div>
        <div className="w-full max-w-sm space-y-1 max-h-52 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-600 truncate max-w-[120px]">{kr ? r.target.name_kr : r.target.name_en}</span>
              <span className="text-gray-400 text-xs">{r.dist.toLocaleString()}km</span>
              <span className="font-bold text-emerald-600">+{r.pts.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <button onClick={reset} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors">
          {kr ? '다시 하기' : 'Play Again'}
        </button>
      </div>
    );
  }

  // Playing / Reveal
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{round + 1} / {ROUNDS}</span>
        <span className="font-bold text-emerald-600">{totalScore.toLocaleString()}{kr ? '점' : ' pts'}</span>
      </div>

      {phase === 'playing' && target && (
        <div className="text-center py-3 bg-emerald-50 rounded-2xl">
          <p className="text-xs text-gray-400 mb-1">{kr ? '이 나라를 지도에서 찾으세요' : 'Find this country on the map'}</p>
          <p className="text-2xl font-bold text-gray-800">{kr ? target.name_kr : target.name_en}</p>
          {kr && <p className="text-sm text-gray-400">{target.name_en}</p>}
        </div>
      )}

      {phase === 'reveal' && last && (
        <div className={`text-center py-3 rounded-2xl ${
          last.dist < 500 ? 'bg-green-50' : last.dist < 2000 ? 'bg-yellow-50' : 'bg-red-50'
        }`}>
          <p className="font-bold text-gray-800">{kr ? last.target.name_kr : last.target.name_en}</p>
          <p className="text-sm text-gray-500">{last.dist.toLocaleString()}km {kr ? '오차' : 'away'}</p>
          <p className="text-xl font-bold text-emerald-600">+{last.pts.toLocaleString()}{kr ? '점' : ' pts'}</p>
          <button
            onClick={next}
            className="mt-2 px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors"
          >
            {round + 1 >= ROUNDS ? (kr ? '결과 보기' : 'See Results') : (kr ? '다음 문제' : 'Next')}
          </button>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-sky-50 shadow-sm">
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 140 }}
          style={{ width: '100%', height: 'auto' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#bbf7d0"
                  stroke="#9ca3af"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover:   { outline: 'none', fill: '#86efac' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {countries.map(c => {
            const isTarget   = phase === 'reveal' && c.id === target?.id;
            const isSelected = phase === 'reveal' && c.id === selected?.id;
            return (
              <Marker
                key={c.id}
                coordinates={[c.lng, c.lat]}
                onClick={() => handleMarker(c)}
                style={{ cursor: phase === 'playing' ? 'pointer' : 'default' }}
              >
                <circle
                  r={isTarget ? 7 : isSelected ? 6 : 3.5}
                  fill={isTarget ? '#10b981' : isSelected ? '#f59e0b' : phase === 'playing' ? '#6b7280' : '#9ca3af'}
                  stroke="white"
                  strokeWidth={isTarget || isSelected ? 2 : 0.5}
                />
                {isTarget && (
                  <text y={-11} fontSize={8} textAnchor="middle" fill="#065f46" fontWeight="bold">
                    {kr ? target.name_kr : target.name_en}
                  </text>
                )}
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      {phase === 'playing' && (
        <p className="text-center text-xs text-gray-400">
          {kr ? '지도에서 나라를 클릭하세요' : 'Click the country on the map'}
        </p>
      )}
    </div>
  );
}
