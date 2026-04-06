function getKey(gameType) {
  return `p4_game_${gameType}`;
}

export const saveGameScore = (gameType, score) => {
  const key = getKey(gameType);
  const current = JSON.parse(localStorage.getItem(key) || '{"best_score":0,"play_count":0}');
  const best_score = Math.max(current.best_score, score);
  const play_count = current.play_count + 1;
  localStorage.setItem(key, JSON.stringify({ best_score, play_count }));
  return Promise.resolve({ data: { best_score, play_count } });
};

export const getGameBestScore = (gameType) => {
  const key = getKey(gameType);
  const data = JSON.parse(localStorage.getItem(key) || '{"best_score":0,"play_count":0}');
  return Promise.resolve({ data });
};

export const getRecentScores = (_gameType) => Promise.resolve({ data: [] });
