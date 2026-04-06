import { useState, useEffect } from 'react';
import {
  Music, VolumeX, Volume2, SkipForward, SkipBack,
  Play, Pause, ChevronLeft
} from 'lucide-react';
import useBGM from '../hooks/useBGM';
import AppleGame from '../games/AppleGame';
import StorkGame from '../games/StorkGame';
import TileMatchGame from '../games/TileMatchGame';
import PinballLadderGame from '../games/PinballLadderGame';
import PaceGame from '../games/PaceGame';
import PatternGame from '../games/PatternGame';
import PinpointGame from '../games/PinpointGame';
import useLangStore from '../store/langStore';
import { t } from '../i18n/texts';

const GAMES = [
  {
    id: 'apple',
    emoji: '🍎',
    thumbnail: null,
    subtitle: 'Fruit Box',
    color: 'from-red-400 to-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    btnColor: 'bg-red-500 hover:bg-red-600',
  },
  {
    id: 'stork',
    emoji: null,
    thumbnail: '/ryan_walk.gif',
    thumbnailFit: 'object-contain',
    subtitle: 'Walk the Stork',
    color: 'from-green-400 to-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    btnColor: 'bg-green-500 hover:bg-green-600',
  },
  {
    id: 'tile_match',
    emoji: null,
    thumbnail: '/face_images/thumb_ryan.png',
    thumbnailFit: 'object-contain',
    subtitle: '3-Tile Matching',
    color: 'from-purple-400 to-indigo-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    btnColor: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    id: 'pinball_ladder',
    emoji: '🎰',
    thumbnail: null,
    subtitle: 'Pinball Ladder',
    color: 'from-indigo-400 to-purple-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    btnColor: 'bg-indigo-500 hover:bg-indigo-600',
  },
  {
    id: 'pace',
    emoji: '⚡',
    thumbnail: null,
    subtitle: 'Reaction Time',
    color: 'from-cyan-400 to-blue-500',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    btnColor: 'bg-cyan-500 hover:bg-cyan-600',
  },
  {
    id: 'pattern',
    emoji: '🎮',
    thumbnail: null,
    subtitle: 'Simon Says',
    color: 'from-purple-400 to-pink-500',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    btnColor: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    id: 'pinpoint',
    emoji: '🌍',
    thumbnail: null,
    subtitle: 'World Map Quiz',
    color: 'from-emerald-400 to-teal-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    btnColor: 'bg-emerald-500 hover:bg-emerald-600',
  },
];

function BGMControls({ bgm }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm w-full max-w-xl">
      <Music size={16} className="text-purple-500 shrink-0" />

      {/* 트랙 이름 */}
      <span className="text-sm text-gray-600 truncate min-w-0 flex-1">
        {bgm.isPlaying ? bgm.trackName : '▶ 음악 재생하기'}
      </span>

      {/* 이전 곡 */}
      <button
        onClick={bgm.prev}
        className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
        title="이전 곡"
      >
        <SkipBack size={16} />
      </button>

      {/* 재생/정지 */}
      <button
        onClick={bgm.isPlaying ? bgm.pause : bgm.play}
        className="p-1.5 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
        title={bgm.isPlaying ? '정지' : '재생'}
      >
        {bgm.isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* 다음 곡 */}
      <button
        onClick={bgm.next}
        className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
        title="다음 곡"
      >
        <SkipForward size={16} />
      </button>

      {/* 뮤트 */}
      <button
        onClick={bgm.toggleMute}
        className={`p-1 transition-colors ${bgm.isMuted ? 'text-red-400' : 'text-gray-400 hover:text-gray-700'}`}
        title={bgm.isMuted ? '음소거 해제' : '음소거'}
      >
        {bgm.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      {/* 볼륨 슬라이더 */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={bgm.isMuted ? 0 : bgm.volume}
        onChange={e => bgm.changeVolume(Number(e.target.value))}
        className="w-20 accent-purple-500"
        title="볼륨"
      />

      {/* 트랙 번호 */}
      <span className="text-xs text-gray-300 shrink-0 hidden sm:inline">
        {bgm.trackIndex + 1}/{bgm.totalTracks}
      </span>
    </div>
  );
}

export default function PlayPage() {
  const bgm = useBGM();
  const lang = useLangStore(s => s.lang);
  const [selectedGame, setSelectedGame] = useState(null);

  // Play 탭 진입 시 자동 재생
  useEffect(() => {
    bgm.play();
    return () => bgm.pause();
  }, []);

  const handleSelectGame = (gameId) => {
    setSelectedGame(gameId);
  };

  const handleBack = () => {
    setSelectedGame(null);
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      {/* BGM 컨트롤 바 */}
      <div className="flex justify-center">
        <BGMControls bgm={bgm} />
      </div>

      {/* 게임 선택 화면 */}
      {!selectedGame && (
        <div>
          <h2 className="text-xl font-bold text-gray-700 mb-4 text-center">{t(lang, 'play_game_select')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GAMES.map(game => (
              <div
                key={game.id}
                className={`rounded-2xl border-2 ${game.border} ${game.bg} p-6 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition-shadow`}
              >
                {/* 게임 카드 헤더 */}
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center text-3xl shadow overflow-hidden`}>
                  {game.thumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt=""
                      className={`w-full h-full ${game.thumbnailFit ?? 'object-cover'}`}
                    />
                  ) : (
                    game.emoji
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-800">{t(lang, `play_${game.id}_title`)}</h3>
                  <p className="text-xs text-gray-400 mb-1">{game.subtitle}</p>
                  <p className="text-sm text-gray-600">{t(lang, `play_${game.id}_desc`)}</p>
                </div>
                <button
                  onClick={() => handleSelectGame(game.id)}
                  className={`mt-2 px-6 py-2.5 ${game.btnColor} text-white rounded-xl font-bold transition-colors shadow`}
                >
                  {t(lang, 'play_start_game')}
                </button>
              </div>
            ))}
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-sm text-gray-400 mt-6">
            {t(lang, 'play_score_saved')}
          </p>
        </div>
      )}

      {/* 게임 플레이 화면 */}
      {selectedGame && (
        <div>
          {/* 뒤로가기 + 게임 타이틀 */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft size={18} />
              {t(lang, 'play_back_list')}
            </button>
            <span className="text-gray-300">|</span>
            <span className="font-bold text-gray-700">
              {t(lang, `play_${selectedGame}_title`)}
            </span>
          </div>

          {/* 게임 컴포넌트 */}
          {selectedGame === 'apple' && (
            <AppleGame onGameEnd={() => {}} />
          )}
          {selectedGame === 'stork' && (
            <StorkGame onGameEnd={() => {}} />
          )}
          {selectedGame === 'tile_match' && (
            <TileMatchGame onGameEnd={() => {}} />
          )}
          {selectedGame === 'pinball_ladder' && (
            <PinballLadderGame onGameEnd={() => {}} />
          )}
          {selectedGame === 'pace' && (
            <PaceGame onGameEnd={() => {}} lang={lang} />
          )}
          {selectedGame === 'pattern' && (
            <PatternGame onGameEnd={() => {}} lang={lang} />
          )}
          {selectedGame === 'pinpoint' && (
            <PinpointGame onGameEnd={() => {}} lang={lang} />
          )}
        </div>
      )}
    </div>
  );
}
