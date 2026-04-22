import client from './client';

export const getMyDashboard = () => client.get('/popular/me');
export const getTrends = (windowDays = 7) =>
  client.get('/popular/trends', { params: { window_days: windowDays } });
export const getLeaderboards = (topN = 10) =>
  client.get('/popular/leaderboards', { params: { top_n: topN } });
