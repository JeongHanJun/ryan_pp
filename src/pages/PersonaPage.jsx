import { useState, useRef } from 'react';
import { Clock, ListChecks, ArrowLeft, ArrowRight, Home, Sparkles } from 'lucide-react';
import useLangStore from '../store/langStore';
import { t } from '../i18n/texts';
import * as api from '../api/persona';

const PER_PAGE = 10;

const SET_ICONS = {
  pokemon: '/character_images/pokemon.png',
  digimon: '/character_images/digimon.png',
  kakao_friends: '/character_images/kakao_friends.png',
};

function SetIcon({ setId, className }) {
  const src = SET_ICONS[setId];
  return src
    ? <img src={src} alt={setId} className={`bg-white ${className}`} />
    : <span className="text-4xl">🎭</span>;
}

const AXIS_INFO = {
  kr: {
    E: { name: '외향성 (E)', color: '#f59e0b' },
    I: { name: '내향성 (I)', color: '#6366f1' },
    S: { name: '감각형 (S)', color: '#22c55e' },
    N: { name: '직관형 (N)', color: '#8b5cf6' },
    T: { name: '사고형 (T)', color: '#3b82f6' },
    F: { name: '감정형 (F)', color: '#ec4899' },
    J: { name: '판단형 (J)', color: '#14b8a6' },
    P: { name: '인식형 (P)', color: '#f97316' },
  },
  en: {
    E: { name: 'Extraversion (E)', color: '#f59e0b' },
    I: { name: 'Introversion (I)', color: '#6366f1' },
    S: { name: 'Sensing (S)', color: '#22c55e' },
    N: { name: 'Intuition (N)', color: '#8b5cf6' },
    T: { name: 'Thinking (T)', color: '#3b82f6' },
    F: { name: 'Feeling (F)', color: '#ec4899' },
    J: { name: 'Judging (J)', color: '#14b8a6' },
    P: { name: 'Perceiving (P)', color: '#f97316' },
  },
};

const AXIS_PAIRS = [['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']];

function CharacterImg({ imagePath, altText, className }) {
  const handleError = (e) => {
    const src = e.target.src;
    if (src.endsWith('.png')) {
      e.target.src = src.replace('.png', '.jpg');
    } else {
      e.target.style.display = 'none';
    }
  };
  return (
    <img
      src={`/${imagePath}`}
      alt={altText}
      className={className}
      onError={handleError}
    />
  );
}

export default function PersonaPage() {
  const [mode, setMode] = useState('home'); // home | select | test | result
  const [characterSets, setCharacterSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);
  const [testData, setTestData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [pageIdx, setPageIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const topRef = useRef(null);

  const { lang } = useLangStore();
  const axisInfo = AXIS_INFO[lang] || AXIS_INFO.en;

  const reset = () => {
    setMode('home');
    setSelectedSet(null);
    setTestData(null);
    setAnswers({});
    setPageIdx(0);
    setResult(null);
    setError('');
  };

  // ── Load character sets ──────────────────
  const loadSets = async () => {
    setLoading(true);
    try {
      const res = await api.getCharacterSets();
      setCharacterSets(res.data);
      setMode('select');
    } catch {
      setError(t(lang, 'error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Start test ───────────────────────────
  const startTest = async (charSet) => {
    setSelectedSet(charSet);
    setLoading(true);
    try {
      const qRes = await api.getQuestions(lang);
      setTestData(qRes.data);
      setAnswers({});
      setPageIdx(0);
      setMode('test');
    } catch {
      setError(t(lang, 'error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Submit ───────────────────────────────
  const submitTest = async () => {
    const questions = testData?.questions || [];
    const allMissing = questions.filter((q) => !(String(q.id) in answers));
    if (allMissing.length > 0) {
      setError(t(lang, 'missing_msg'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.submitAttempt(null, answers, selectedSet.id, lang);
      setResult(res.data);
      setMode('result');
    } catch {
      setError(t(lang, 'error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Test View ────────────────────────────
  if (mode === 'test' && testData) {
    const questions = testData.questions;
    const totalPages = Math.ceil(questions.length / PER_PAGE);
    const pageQuestions = questions.slice(pageIdx * PER_PAGE, (pageIdx + 1) * PER_PAGE);
    const scaleLabels = {};
    (testData.scale?.labels || []).forEach((l) => { scaleLabels[l.value] = l.text; });
    const scaleValues = Object.keys(scaleLabels).map(Number).sort((a, b) => a - b);
    const answeredCount = Object.keys(answers).length;
    const isLast = pageIdx === totalPages - 1;

    const goNext = () => {
      const missing = pageQuestions.filter((q) => !(String(q.id) in answers));
      if (missing.length > 0) {
        setError(t(lang, 'missing_msg'));
        return;
      }
      setError('');
      setPageIdx((p) => p + 1);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
      <div ref={topRef}>
        <div className="flex items-center gap-3 mb-4">
          <SetIcon setId={selectedSet?.id} className="w-48 h-32 object-contain" />
          <div>
            <h2 className="text-xl font-bold">{lang === 'kr' ? selectedSet?.name_kr : selectedSet?.name_en}</h2>
            <p className="text-sm text-gray-500">{testData.test_name}</p>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
          <div className="bg-purple-600 h-2.5 rounded-full transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
        <p className="text-sm text-gray-500 mb-4">{answeredCount} / {questions.length}</p>

        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 text-center font-bold mb-6">
          {t(lang, 'page')} {pageIdx + 1} / {totalPages}
        </div>

        <div className="space-y-6">
          {pageQuestions.map((q) => (
            <div key={q.id} className="card">
              <p className="font-medium mb-3">{q.id}. {q.text}</p>
              <div className="flex flex-wrap gap-2">
                {scaleValues.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAnswers((prev) => ({ ...prev, [String(q.id)]: v }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      answers[String(q.id)] === v
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    {v} · {scaleLabels[v]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setPageIdx((p) => p - 1); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={pageIdx === 0}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> {t(lang, 'prev')}
          </button>
          {!isLast ? (
            <button onClick={goNext} className="btn-primary flex-1 flex items-center justify-center gap-2" style={{ background: 'linear-gradient(to right, #8b5cf6, #ec4899)' }}>
              {t(lang, 'next')} <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={submitTest} disabled={loading} className="btn-primary flex-1" style={{ background: 'linear-gradient(to right, #8b5cf6, #ec4899)' }}>
              {loading ? '...' : t(lang, 'submit')}
            </button>
          )}
          <button onClick={reset} className="btn-secondary flex items-center justify-center gap-2">
            <Home size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Result View ──────────────────────────
  if (mode === 'result' && result) {
    const { mbti_type, character, score_0_100, mbti_description, character_set } = result;
    const charName = lang === 'kr' ? character.name_kr : character.name_en;
    const charDesc = lang === 'kr' ? character.description_kr : character.description_en;
    const mbtiName = lang === 'kr' ? mbti_description.name_kr : mbti_description.name_en;
    const mbtiShort = lang === 'kr' ? mbti_description.short_kr : mbti_description.short_en;

    return (
      <div>
        <h2 className="text-xl font-bold mb-1">{t(lang, 'persona_result_title')}</h2>

        {/* MBTI Type Card */}
        <div className="card mb-6 text-center bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <p className="text-sm text-gray-500 mb-2">{t(lang, 'persona_your_type')}</p>
          <div className="text-5xl font-black text-purple-700 mb-2">{mbti_type}</div>
          <div className="text-lg font-bold text-gray-700">{mbtiName}</div>
          <div className="text-sm text-gray-500">{mbtiShort}</div>
        </div>

        {/* Character Card */}
        <div className="card mb-6 text-center">
          <p className="text-sm text-gray-500 mb-3">{t(lang, 'persona_your_character')}</p>
          {character.image_path ? (
            <div className="w-36 h-36 mx-auto mb-3 rounded-2xl shadow overflow-hidden bg-white">
              <CharacterImg
                imagePath={character.image_path}
                altText={charName}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="mb-3"><SetIcon setId={character_set} className="w-[36rem] h-96 object-contain mx-auto" /></div>
          )}
          <div className="text-2xl font-bold text-gray-800 mb-1">{charName}</div>
          <p className="text-gray-600 leading-relaxed max-w-md mx-auto">{charDesc}</p>
        </div>

        {/* Axis Scores */}
        <div className="card mb-6">
          <h3 className="font-bold mb-4">{lang === 'kr' ? 'MBTI 축별 점수' : 'MBTI Axis Scores'}</h3>
          <div className="space-y-4">
            {AXIS_PAIRS.map(([a, b]) => {
              const aScore = score_0_100[a] ?? 50;
              const bScore = score_0_100[b] ?? 50;
              const total = aScore + bScore || 100;
              const aPct = (aScore / total) * 100;
              return (
                <div key={`${a}${b}`}>
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span style={{ color: axisInfo[a]?.color }}>{axisInfo[a]?.name} ({aScore.toFixed(0)})</span>
                    <span style={{ color: axisInfo[b]?.color }}>{axisInfo[b]?.name} ({bScore.toFixed(0)})</span>
                  </div>
                  <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="transition-all duration-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{ width: `${aPct}%`, backgroundColor: axisInfo[a]?.color }}
                    >
                      {aPct >= 20 ? `${aPct.toFixed(0)}%` : ''}
                    </div>
                    <div
                      className="transition-all duration-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{ width: `${100 - aPct}%`, backgroundColor: axisInfo[b]?.color }}
                    >
                      {100 - aPct >= 20 ? `${(100 - aPct).toFixed(0)}%` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={() => { reset(); loadSets(); }} className="btn-primary w-full" style={{ background: 'linear-gradient(to right, #8b5cf6, #ec4899)' }}>
          {t(lang, 'retake')}
        </button>
      </div>
    );
  }

  // ── Select Character Set ─────────────────
  if (mode === 'select') {
    return (
      <div>
        <h2 className="text-xl font-bold mb-2">{t(lang, 'select_character_set')}</h2>
        <p className="text-gray-500 mb-6">{t(lang, 'persona_desc')}</p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {characterSets.map((cs) => (
            <button
              key={cs.id}
              onClick={() => startTest(cs)}
              disabled={loading}
              className="card hover:border-purple-300 hover:shadow-md transition-all text-left group"
            >
              <div className="mb-3 overflow-hidden rounded-lg bg-white"><SetIcon setId={cs.id} className="w-full h-48 object-contain" /></div>
              <div className="font-bold text-lg group-hover:text-purple-700 transition-colors">
                {lang === 'kr' ? cs.name_kr : cs.name_en}
              </div>
              <div className="text-sm text-gray-500 mb-2">
                {lang === 'kr' ? cs.description_kr : cs.description_en}
              </div>
              <div className="text-xs text-gray-400">
                {cs.character_count} {t(lang, 'characters')} · 20 {t(lang, 'items')}
              </div>
            </button>
          ))}
        </div>

        <button onClick={reset} className="btn-secondary w-full">{t(lang, 'back_home')}</button>
      </div>
    );
  }

  // ── Home ─────────────────────────────────
  return (
    <div>
      <h2 className="text-2xl font-bold">{t(lang, 'persona_title')}</h2>
      <p className="text-gray-500 mb-2">{t(lang, 'persona_subtitle')}</p>
      <p className="text-gray-600 mb-6">{t(lang, 'persona_desc')}</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card flex items-center gap-3 text-sm">
          <Clock size={20} className="text-purple-500 shrink-0" />
          <span>{t(lang, 'persona_info_time')}</span>
        </div>
        <div className="card flex items-center gap-3 text-sm">
          <ListChecks size={20} className="text-purple-500 shrink-0" />
          <span>{t(lang, 'persona_info_items')}</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <button onClick={loadSets} disabled={loading} className="btn-primary w-full" style={{ background: 'linear-gradient(to right, #8b5cf6, #ec4899)' }}>
        <Sparkles size={16} className="inline mr-2" />
        {loading ? '...' : t(lang, 'persona_start')}
      </button>
    </div>
  );
}
