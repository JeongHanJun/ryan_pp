import { computeBig5Scores } from '../lib/scoring';

export const getQuestions = async (lang = 'kr') => {
  const res = await fetch(`./data/questions_${lang}.json`);
  const data = await res.json();
  return { data };
};

export const submitAttempt = async (_attemptId, answers, lang = 'kr') => {
  const res = await fetch(`./data/questions_${lang}.json`);
  const testData = await res.json();
  const score_pack = computeBig5Scores(testData.questions, answers);
  return { data: { score_pack } };
};
