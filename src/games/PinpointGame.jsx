import { useState, useEffect } from 'react';
import {
  ComposableMap, Geographies, Geography, Marker,
  ZoomableGroup, useMapContext,
} from 'react-simple-maps';

const GEO_URL = './data/world-atlas.json';
const ROUNDS  = 10;
const MAP_W   = 800;
const MAP_H   = 500;

// ISO 3166-1 numeric → alpha-2 mapping (world-atlas uses numeric IDs)
const ISO_N = {
  4:'AF', 12:'DZ', 32:'AR', 36:'AU', 40:'AT', 50:'BD', 56:'BE', 68:'BO',
  76:'BR', 100:'BG', 112:'BY', 116:'KH', 124:'CA', 144:'LK', 152:'CL',
  156:'CN', 158:'TW', 170:'CO', 191:'HR', 192:'CU', 203:'CZ', 208:'DK',
  218:'EC', 231:'ET', 246:'FI', 250:'FR', 276:'DE', 288:'GH', 300:'GR',
  348:'HU', 352:'IS', 356:'IN', 360:'ID', 364:'IR', 368:'IQ', 372:'IE',
  376:'IL', 380:'IT', 392:'JP', 398:'KZ', 404:'KE', 410:'KR', 450:'MG',
  458:'MY', 484:'MX', 496:'MN', 504:'MA', 524:'NP', 528:'NL', 554:'NZ',
  566:'NG', 578:'NO', 586:'PK', 604:'PE', 608:'PH', 616:'PL', 620:'PT',
  642:'RO', 643:'RU', 682:'SA', 688:'RS', 702:'SG', 703:'SK', 704:'VN',
  710:'ZA', 724:'ES', 729:'SD', 752:'SE', 756:'CH', 764:'TH', 784:'AE',
  792:'TR', 804:'UA', 826:'GB', 834:'TZ', 840:'US', 858:'UY', 860:'UZ',
  862:'VE',
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
}

// Correct country: exponential decay from centroid (max 5000)
function scoreCorrect(dist) {
  return Math.max(50, Math.round(5000 * Math.exp(-dist / 400)));
}

// Wrong country: penalty based on distance to target
function scorePenalty(dist) {
  return -Math.min(3000, Math.round(300 + dist / 2.5));
}

// ── Inner component — must be inside ComposableMap to use useMapContext ───────
function MapContent({ phase, target, selectedA2, countries, mapPos, onCountryClick }) {
  const { projection } = useMapContext();

  const clickToLatLng = (e) => {
    try {
      const svg = e.currentTarget.closest('svg');
      const pt  = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      // Convert screen → SVG root coordinates (accounts for CSS scaling)
      const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

      // Undo ZoomableGroup transform:
      // ZoomableGroup applies: translate(W/2 - z*px, H/2 - z*py) scale(z)
      // where [px,py] = projection(center)
      // Inverse: projX = (svgX - W/2) / z + px
      const projCenter = projection(mapPos.coordinates);
      if (!projCenter) return null;
      const z    = mapPos.zoom;
      const projX = (svgPt.x - MAP_W / 2) / z + projCenter[0];
      const projY = (svgPt.y - MAP_H / 2) / z + projCenter[1];
      return projection.invert([projX, projY]); // [lng, lat]
    } catch {
      return null;
    }
  };

  const handleGeoClick = (geo, e) => {
    if (phase !== 'playing') return;
    const a2    = ISO_N[parseInt(geo.id, 10)];
    const coord = clickToLatLng(e); // [lng, lat] or null
    onCountryClick(a2, coord);
  };

  const revealTarget   = phase === 'reveal' && target;

  return (
    <>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map(geo => {
            const a2       = ISO_N[parseInt(geo.id, 10)];
            const isTarget = revealTarget && a2 === target.id;
            const isWrong  = revealTarget && a2 === selectedA2 && a2 !== target.id;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={(e) => handleGeoClick(geo, e)}
                fill={isTarget ? '#6ee7b7' : isWrong ? '#fca5a5' : '#d1fae5'}
                stroke="#9ca3af"
                strokeWidth={0.3}
                style={{
                  default: { outline: 'none' },
                  hover: phase === 'playing'
                    ? { fill: '#a7f3d0', outline: 'none', cursor: 'pointer' }
                    : { fill: isTarget ? '#6ee7b7' : isWrong ? '#fca5a5' : '#d1fae5', outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            );
          })
        }
      </Geographies>

      {/* Target centroid star marker (shown after reveal) */}
      {revealTarget && (
        <Marker coordinates={[target.lng, target.lat]}>
          <circle r={6} fill="#10b981" stroke="white" strokeWidth={2} />
          <text
            y={-11} fontSize={10} textAnchor="middle"
            fill="#065f46" fontWeight="bold" style={{ pointerEvents: 'none' }}
          >
            ★
          </text>
        </Marker>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PinpointGame({ onGameEnd, lang = 'kr' }) {
  const [countries, setCountries] = useState([]);
  const [round,     setRound]     = useState(0);
  const [target,    setTarget]    = useState(null);
  const [selectedA2, setSel]      = useState(null);
  const [results,   setResults]   = useState([]);
  const [phase,     setPhase]     = useState('idle');
  const [total,     setTotal]     = useState(0);
  const [mapPos,    setMapPos]    = useState({ coordinates: [0, 20], zoom: 1 });
  const kr = lang === 'kr';

  useEffect(() => {
    fetch('./data/pinpoint_countries.json').then(r => r.json()).then(setCountries);
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
    setSel(null);
    setPhase('playing');
    setMapPos({ coordinates: [0, 20], zoom: 1 });
  };

  const handleCountryClick = (clickedA2, coord) => {
    if (phase !== 'playing') return;

    const clickedCountry = countries.find(c => c.id === clickedA2);
    let pts, dist, correct;

    if (clickedA2 === target.id) {
      correct = true;
      // Measure how close the click was to the centroid
      if (coord) {
        dist = haversine(target.lat, target.lng, coord[1], coord[0]);
      } else {
        dist = 0;
      }
      pts = scoreCorrect(dist);
    } else {
      correct = false;
      // Penalty based on distance from clicked country to target
      dist = clickedCountry
        ? haversine(target.lat, target.lng, clickedCountry.lat, clickedCountry.lng)
        : 9000;
      pts = scorePenalty(dist);
    }

    const res = { target, clickedA2, clickedCountry, correct, dist, pts };
    setResults(prev => [...prev, res]);
    setTotal(s => s + pts);
    setSel(clickedA2);
    setPhase('reveal');
  };

  const next = () => {
    const nr = round + 1;
    if (nr >= ROUNDS) {
      setPhase('finished');
      if (onGameEnd) onGameEnd(total);
      return;
    }
    const used = [...results.map(r => r.target.id), target?.id].filter(Boolean);
    const t = pick(used);
    setTarget(t);
    setSel(null);
    setRound(nr);
    setPhase('playing');
  };

  const reset = () => {
    setPhase('idle');
    setRound(0);
    setTarget(null);
    setSel(null);
    setResults([]);
    setTotal(0);
    setMapPos({ coordinates: [0, 20], zoom: 1 });
  };

  const last       = results[results.length - 1];
  const scoreColor = total >= 0 ? 'text-emerald-600' : 'text-red-500';

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <div className="text-6xl">🌍</div>
        <h3 className="text-xl font-bold text-gray-700">{kr ? '세계 지도 퀴즈' : 'World Map Quiz'}</h3>
        <p className="text-gray-500 text-sm text-center max-w-sm">
          {kr
            ? '국가 이름이 주어지면 지도에서 해당 나라를 직접 클릭하세요.'
            : 'Click directly on the country shown.'}
        </p>
        <div className="flex gap-3 text-xs text-center">
          <div className="bg-green-50 rounded-xl px-4 py-2">
            <div className="font-bold text-green-600 mb-0.5">{kr ? '✓ 정답' : '✓ Correct'}</div>
            <div className="text-gray-500">{kr ? '클릭 위치 정확도에 따라' : 'Based on click accuracy'}</div>
            <div className="font-semibold text-green-600">+50 ~ +5,000</div>
          </div>
          <div className="bg-red-50 rounded-xl px-4 py-2">
            <div className="font-bold text-red-500 mb-0.5">{kr ? '✗ 오답' : '✗ Wrong'}</div>
            <div className="text-gray-500">{kr ? '거리에 따라 감점' : 'Penalty by distance'}</div>
            <div className="font-semibold text-red-500">-300 ~ -3,000</div>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          {ROUNDS}{kr ? '문제 · 마우스 휠로 확대/축소 · 드래그로 이동' : ' rounds · Scroll to zoom · Drag to pan'}
        </p>
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

  // ── Finished ──────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const maxPts = ROUNDS * 5000;
    const grade  = total >= maxPts * 0.8 ? (kr ? '🌟 지리 천재'  : '🌟 Geography Genius')
                 : total >= maxPts * 0.5 ? (kr ? '🗺️ 지도 박사'  : '🗺️ Map Expert')
                 : total >= 0            ? (kr ? '✈️ 여행가'     : '✈️ Traveler')
                 :                         (kr ? '📍 지구인'     : '📍 Earthling');
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="text-5xl">{grade.split(' ')[0]}</div>
        <div className="bg-white rounded-2xl shadow p-6 text-center w-full max-w-sm">
          <p className="text-gray-400 text-sm mb-1">{kr ? '총 점수' : 'Total Score'}</p>
          <p className={`text-4xl font-bold ${total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {total >= 0 ? '+' : ''}{total.toLocaleString()}
            <span className="text-xl text-gray-300">/{maxPts.toLocaleString()}</span>
          </p>
          <p className="mt-2 text-lg font-semibold text-gray-700">{grade}</p>
        </div>
        <div className="w-full max-w-sm space-y-1 max-h-52 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span>{r.correct ? '✅' : '❌'}</span>
              <span className="text-gray-600 truncate max-w-[100px]">{kr ? r.target.name_kr : r.target.name_en}</span>
              <span className="text-gray-400 text-xs">{r.dist.toLocaleString()}km</span>
              <span className={`font-bold ${r.pts >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {r.pts > 0 ? '+' : ''}{r.pts.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <button onClick={reset} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors">
          {kr ? '다시 하기' : 'Play Again'}
        </button>
      </div>
    );
  }

  // ── Playing / Reveal ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{round + 1} / {ROUNDS}</span>
        <span className={`font-bold tabular-nums ${scoreColor}`}>
          {total >= 0 ? '+' : ''}{total.toLocaleString()}{kr ? '점' : ' pts'}
        </span>
      </div>

      {/* Target prompt */}
      {phase === 'playing' && target && (
        <div className="text-center py-3 bg-emerald-50 rounded-2xl">
          <p className="text-xs text-gray-400 mb-1">
            {kr ? '이 나라를 지도에서 클릭하세요' : 'Click this country on the map'}
          </p>
          <p className="text-2xl font-bold text-gray-800">{kr ? target.name_kr : target.name_en}</p>
          {kr && <p className="text-sm text-gray-400">{target.name_en}</p>}
        </div>
      )}

      {/* Reveal feedback */}
      {phase === 'reveal' && last && (
        <div className={`text-center py-3 rounded-2xl ${last.correct ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="font-bold text-gray-800">
            {last.correct ? '✅ ' : '❌ '}
            {kr ? last.target.name_kr : last.target.name_en}
          </p>
          {!last.correct && last.clickedCountry && (
            <p className="text-sm text-gray-500">
              {kr ? '선택한 나라: ' : 'You clicked: '}
              <span className="font-medium">{kr ? (last.clickedCountry.name_kr || '미확인') : (last.clickedCountry.name_en || 'Unknown')}</span>
            </p>
          )}
          {!last.correct && !last.clickedCountry && (
            <p className="text-sm text-gray-500">{kr ? '인식할 수 없는 지역' : 'Unrecognized area'}</p>
          )}
          <p className="text-sm text-gray-500 mt-0.5">
            {last.correct
              ? `${kr ? '중심까지 오차' : 'Distance from center'}: ${last.dist.toLocaleString()}km`
              : `${kr ? '정답까지 거리' : 'Distance to target'}: ${last.dist.toLocaleString()}km`}
          </p>
          <p className={`text-xl font-bold mt-1 ${last.pts >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {last.pts > 0 ? '+' : ''}{last.pts.toLocaleString()}{kr ? '점' : ' pts'}
          </p>
          <button
            onClick={next}
            className="mt-2 px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-colors"
          >
            {round + 1 >= ROUNDS ? (kr ? '결과 보기' : 'See Results') : (kr ? '다음 문제' : 'Next')}
          </button>
        </div>
      )}

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-sky-50 shadow-sm select-none">
        <ComposableMap
          width={MAP_W}
          height={MAP_H}
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 140 }}
          style={{ width: '100%', height: 'auto' }}
        >
          <ZoomableGroup
            zoom={mapPos.zoom}
            center={mapPos.coordinates}
            onMoveEnd={setMapPos}
            minZoom={1}
            maxZoom={12}
          >
            <MapContent
              phase={phase}
              target={target}
              selectedA2={selectedA2}
              countries={countries}
              mapPos={mapPos}
              onCountryClick={handleCountryClick}
            />
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <p className="text-center text-xs text-gray-400">
        {phase === 'playing'
          ? (kr ? '나라를 클릭하세요 · 휠 확대 · 드래그 이동' : 'Click a country · Scroll to zoom · Drag to pan')
          : (kr ? '휠 확대 · 드래그로 이동 가능' : 'Scroll to zoom · Drag to pan')}
      </p>
    </div>
  );
}
