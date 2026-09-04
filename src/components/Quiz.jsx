import { useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import QuestionCard from './QuestionCard';
import Feedback from './Feedback';
import QuizProgress from './QuizProgress';

export default function Quiz() {
  const { quizState } = useOutletContext();
  const navigate = useNavigate();
  const {
    currentQuestion,
    currentQuestionIndex,
    filteredQuestions,
    answers,
    stats,
    submitAnswer,
    nextQuestion,
    previousQuestion,
  } = quizState;

  const existingAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isLastQuestion = currentQuestionIndex >= filteredQuestions.length - 1;

  const handleKeyDown = useCallback((e) => {
    if (!currentQuestion) return;

    if (e.key === 'Escape') {
      navigate('..');
      return;
    }

    if (existingAnswer) {
      if ((e.key === 'ArrowRight' || e.key === 'n') && !isLastQuestion) {
        nextQuestion();
      }
      if (e.key === 'ArrowLeft' || e.key === 'p') {
        previousQuestion();
      }
      return;
    }

    const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
    if (keyMap[e.key]) {
      const optKey = keyMap[e.key];
      if (currentQuestion.options.find(o => o.key === optKey)) {
        document.querySelector(`[data-option="${optKey}"]`)?.click();
      }
    }

    if (e.key === 'Enter') {
      document.querySelector('[data-submit]')?.click();
    }
  }, [currentQuestion, existingAnswer, isLastQuestion, nextQuestion, previousQuestion, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!currentQuestion) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-4">No questions match your filters</h2>
        <Button variant="secondary" onClick={() => navigate('..')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-5">
      <QuizProgress
        current={currentQuestionIndex}
        total={filteredQuestions.length}
        stats={stats}
      />
      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        onSubmit={submitAnswer}
        existingAnswer={existingAnswer}
      />
      <Feedback question={currentQuestion} answer={existingAnswer} />
      {existingAnswer && (
        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
            className="flex-1"
          >
            Previous
          </Button>
          {!isLastQuestion ? (
            <Button onClick={nextQuestion} className="flex-1">
              Next Question
            </Button>
          ) : (
            <Button onClick={() => navigate('..')} className="flex-1">
              Finish
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
