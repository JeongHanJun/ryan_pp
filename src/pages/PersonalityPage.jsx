import { useState, useRef } from 'react';
import { Clock, ListChecks, BarChart3, ArrowLeft, ArrowRight, Home } from 'lucide-react';
import useLangStore from '../store/langStore';
import { t, traitInfo } from '../i18n/texts';
import RadarChart from '../components/RadarChart';
import HBarChart from '../components/BarChart';
import * as api from '../api/personality';

const PER_PAGE = 10;
const SCORE_HIGH = 65;
const SCORE_LOW = 35;

function traitLevel(score) {
  if (score >= SCORE_HIGH) return 'high';
  if (score >= SCORE_LOW) return 'mid';
  return 'low';
}
const levelColor = { high: '#22c55e', mid: '#3b82f6', low: '#ef4444' };
const TRAIT_ORDER = ['O', 'C', 'E', 'A', 'N'];

export default function PersonalityPage() {
  const [mode, setMode] = useState('home'); // home | test | result
  const [testData, setTestData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [pageIdx, setPageIdx] = useState(0);
  const [scorePack, setScorePack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const topRef = useRef(null);

  const { lang } = useLangStore();

  const reset = () => {
    setMode('home');
    setTestData(null);
    setAnswers({});
    setPageIdx(0);
    setScorePack(null);
    setError('');
  };

  // ── Home ─────────────────────────────────
  const startTest = async () => {
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

  // ── Test ─────────────────────────────────
  const questions = testData?.questions || [];
  const totalPages = Math.ceil(questions.length / PER_PAGE);
  const pageQuestions = questions.slice(pageIdx * PER_PAGE, (pageIdx + 1) * PER_PAGE);
  const scaleLabels = {};
  (testData?.scale?.labels || []).forEach((l) => { scaleLabels[l.value] = l.text; });
  const scaleValues = Object.keys(scaleLabels).map(Number).sort((a, b) => a - b);

  const setAnswer = (qid, val) => {
    setAnswers((prev) => ({ ...prev, [String(qid)]: val }));
  };

  const pageMissing = () => pageQuestions.filter((q) => !(String(q.id) in answers)).map((q) => q.id);

  const goNext = () => {
    const missing = pageMissing();
    if (missing.length > 0) {
      setError(t(lang, 'missing_msg'));
      return;
    }
    setError('');
    setPageIdx((p) => p + 1);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitTest = async () => {
    const allMissing = questions.filter((q) => !(String(q.id) in answers));
    if (allMissing.length > 0) {
      setError(t(lang, 'missing_msg'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.submitAttempt(null, answers, lang);
      setScorePack(res.data.score_pack);
      setMode('result');
    } catch {
      setError(t(lang, 'error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────
  if (mode === 'test' && testData) {
    const answeredCount = Object.keys(answers).length;
    const progress = answeredCount / questions.length;
    const pageStart = pageIdx * PER_PAGE + 1;
    const pageEnd = Math.min((pageIdx + 1) * PER_PAGE, questions.length);
    const isLast = pageIdx === totalPages - 1;

    return (
      <div ref={topRef}>
        <h2 className="text-xl font-bold mb-2">{testData.test_name}</h2>

        {/* Progress */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
          <div className="bg-primary-600 h-2.5 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="text-sm text-gray-500 mb-4">{answeredCount} / {questions.length}</p>

        {/* Page indicator */}
        <div className="bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl p-4 text-center font-bold mb-6">
          {t(lang, 'page')} {pageIdx + 1} / {totalPages} &middot; {pageStart}~{pageEnd}
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {pageQuestions.map((q) => (
            <div key={q.id} className="card">
              <p className="font-medium mb-3">{q.id}. {q.text}</p>
              <div className="flex flex-wrap gap-2">
                {scaleValues.map((v) => (
                  <button
                    key={v}
                    onClick={() => setAnswer(q.id, v)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      answers[String(q.id)] === v
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
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

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { setPageIdx((p) => p - 1); topRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={pageIdx === 0}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> {t(lang, 'prev')}
          </button>
          {!isLast ? (
            <button onClick={goNext} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {t(lang, 'next')} <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={submitTest} disabled={loading} className="btn-primary flex-1">
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

  if (mode === 'result' && scorePack) {
    const scores = scorePack.score_0_100;
    const info = traitInfo[lang] || traitInfo.en;

    return (
      <div>
        <h2 className="text-xl font-bold">{t(lang, 'result_title')}</h2>
        <p className="text-gray-500 mb-6">{t(lang, 'result_subtitle')}</p>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h3 className="font-bold mb-2">{t(lang, 'radar_title')}</h3>
            <RadarChart scores={scores} />
          </div>
          <div className="card">
            <h3 className="font-bold mb-2">{t(lang, 'bar_title')}</h3>
            <HBarChart scores={scores} />
          </div>
        </div>

        <h3 className="text-lg font-bold mb-4">{t(lang, 'detail_title')}</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {TRAIT_ORDER.filter((k) => k in scores).map((k) => {
            const score = scores[k];
            const lv = traitLevel(score);
            return (
              <div key={k} className="card">
                <div className="text-2xl mb-1">{info[k].icon}</div>
                <div className="font-bold">{info[k].name}</div>
                <div className="text-xs text-gray-400 mb-2">{info[k].short}</div>
                <div className="text-2xl font-bold text-primary-600">{score.toFixed(1)}</div>
                <span
                  className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs text-white"
                  style={{ backgroundColor: levelColor[lv] }}
                >
                  {t(lang, lv)}
                </span>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{info[k][lv]}</p>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mb-6">{t(lang, 'result_note')}</p>

        <button onClick={() => { reset(); startTest(); }} className="btn-primary w-full">
          {t(lang, 'retake')}
        </button>
      </div>
    );
  }

  // ── Home ─────────────────────────────────
  return (
    <div>
      <h2 className="text-2xl font-bold">{t(lang, 'p_home_title')}</h2>
      <p className="text-gray-500 mb-2">{t(lang, 'p_home_subtitle')}</p>
      <p className="text-gray-600 mb-6">{t(lang, 'p_home_desc')}</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Clock, text: t(lang, 'p_info_time') },
          { icon: ListChecks, text: t(lang, 'p_info_items') },
          { icon: BarChart3, text: t(lang, 'p_info_dims') },
        ].map(({ icon: Icon, text }, i) => (
          <div key={i} className="card flex items-center gap-3 text-sm">
            <Icon size={20} className="text-primary-500 shrink-0" />
            <span>{text}</span>
          </div>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <button onClick={startTest} disabled={loading} className="btn-primary w-full">
        {loading ? '...' : t(lang, 'start_btn')}
      </button>
    </div>
  );
}
