import { computeMbtiScores, getMbtiDescription } from '../lib/mbtiEngine';
import { CHARACTER_SETS, getCharacterByMbtiAndSet } from '../lib/personaData';

export const getCharacterSets = () => Promise.resolve({ data: CHARACTER_SETS });

export const getQuestions = async (lang = 'kr') => {
  const res = await fetch(`./data/persona_questions_${lang}.json`);
  const data = await res.json();
  return { data };
};

export const submitAttempt = async (_attemptId, answers, characterSet, lang = 'kr') => {
  const res = await fetch(`./data/persona_questions_${lang}.json`);
  const testData = await res.json();
  const { score_0_100, mbti_type } = computeMbtiScores(testData.questions, answers);
  const character = getCharacterByMbtiAndSet(mbti_type, characterSet);
  const mbti_description = getMbtiDescription(mbti_type);
  return { data: { mbti_type, character, score_0_100, mbti_description, character_set: characterSet } };
};
