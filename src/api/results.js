import client from './client';

export const submitBig5 = (payload) => client.post('/results/big5', payload);
export const submitMbti = (payload) => client.post('/results/mbti', payload);
export const submitGame = (payload) => client.post('/results/game', payload);

export const myBig5 = (limit = 20) => client.get('/results/big5/me', { params: { limit } });
export const myMbti = (limit = 20) => client.get('/results/mbti/me', { params: { limit } });
export const myGameBests = () => client.get('/results/game/me');
