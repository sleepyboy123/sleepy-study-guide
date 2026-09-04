import { useState, useCallback, useMemo } from 'react';

export const getStorageKey = (slug) => `sleepy-${slug}-quiz-state`
export const getReviewStatusKey = (slug) => `sleepy-${slug}-review-status`

function loadState(slug) {
  try {
    const stored = localStorage.getItem(getStorageKey(slug));
    if (!stored) return null;
    const saved = JSON.parse(stored);
    if (
      typeof saved !== 'object' || saved === null ||
      typeof saved.answers !== 'object' || saved.answers === null ||
      typeof saved.currentQuestionIndex !== 'number' ||
      !Array.isArray(saved.shuffleOrder) ||
      typeof saved.settings !== 'object' || saved.settings === null
    ) return null;
    return saved;
  } catch {
    return null;
  }
}

function saveState(slug, state) {
  localStorage.setItem(getStorageKey(slug), JSON.stringify(state));
}

function generateShuffleOrder(length) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const DEFAULT_SETTINGS = {
  shuffleQuestions: true,
  showOnlyUnanswered: false,
  filterCategory: null,
  filterConfidence: null,
};

export default function useQuizState(slug, questionsData) {
  const [state, setState] = useState(() => {
    const saved = loadState(slug);
    if (saved) return saved;
    return {
      answers: {},
      currentQuestionIndex: 0,
      shuffleOrder: generateShuffleOrder(questionsData.length),
      settings: DEFAULT_SETTINGS,
    };
  });

  const persist = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveState(slug, next);
      return next;
    });
  }, [slug]);

  const filteredQuestions = useMemo(() => {
    let filtered = questionsData;
    if (state.settings.filterCategory) {
      filtered = filtered.filter(q => q.category === state.settings.filterCategory);
    }
    if (state.settings.filterConfidence) {
      filtered = filtered.filter(q => q.confidence === state.settings.filterConfidence);
    }
    if (state.settings.showOnlyUnanswered) {
      filtered = filtered.filter(q => !state.answers[q.id]);
    }
    if (state.settings.shuffleQuestions) {
      const idSet = new Set(filtered.map(q => q.id));
      const order = state.shuffleOrder.filter(i => idSet.has(questionsData[i]?.id));
      filtered = order.map(i => questionsData[i]).filter(Boolean);
    }
    return filtered;
  }, [questionsData, state.settings, state.answers, state.shuffleOrder]);

  const currentQuestion = filteredQuestions[state.currentQuestionIndex] || null;

  const submitAnswer = useCallback((questionId, selected) => {
    const question = questionsData.find(q => q.id === questionId);
    if (!question) return;
    const correct = question.correctAnswer.length === selected.length
      && question.correctAnswer.every(a => selected.includes(a));
    persist(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: {
          selected,
          correct,
          answeredAt: new Date().toISOString(),
        },
      },
    }));
  }, [questionsData, persist]);

  const nextQuestion = useCallback(() => {
    persist(prev => ({
      ...prev,
      currentQuestionIndex: Math.min(prev.currentQuestionIndex + 1, filteredQuestions.length - 1),
    }));
  }, [persist, filteredQuestions.length]);

  const previousQuestion = useCallback(() => {
    persist(prev => ({
      ...prev,
      currentQuestionIndex: Math.max(prev.currentQuestionIndex - 1, 0),
    }));
  }, [persist]);

  const updateSettings = useCallback((newSettings) => {
    persist(prev => ({
      ...prev,
      currentQuestionIndex: 0,
      settings: { ...prev.settings, ...newSettings },
    }));
  }, [persist]);

  const resetQuiz = useCallback(() => {
    persist(prev => ({
      answers: {},
      currentQuestionIndex: 0,
      shuffleOrder: generateShuffleOrder(questionsData.length),
      settings: prev.settings,
    }));
  }, [questionsData, persist]);

  const stats = useMemo(() => {
    const answered = Object.keys(state.answers).length;
    const correctCount = Object.values(state.answers).filter(a => a.correct).length;
    return {
      total: questionsData.length,
      answered,
      correct: correctCount,
      incorrect: answered - correctCount,
      percentage: answered > 0 ? Math.round((correctCount / answered) * 100) : 0,
      filteredTotal: filteredQuestions.length,
    };
  }, [questionsData, state.answers, filteredQuestions.length]);

  const categories = useMemo(() => {
    const cats = {};
    questionsData.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [questionsData]);

  return {
    questions: questionsData,
    filteredQuestions,
    currentQuestion,
    currentQuestionIndex: state.currentQuestionIndex,
    answers: state.answers,
    settings: state.settings,
    stats,
    categories,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    updateSettings,
    resetQuiz,
  };
}
