import { useState } from 'react';
import useQuizState from '@/hooks/useQuizState';
import Dashboard from './Dashboard';
import Quiz from './Quiz';
import ReviewQueue from './ReviewQueue';

export default function App() {
  const [view, setView] = useState('dashboard');
  const quizState = useQuizState();

  switch (view) {
    case 'quiz':
      return <Quiz quizState={quizState} onExit={() => setView('dashboard')} />;
    case 'review':
      return <ReviewQueue quizState={quizState} onExit={() => setView('dashboard')} />;
    default:
      return (
        <Dashboard
          quizState={quizState}
          onStartQuiz={() => setView('quiz')}
          onOpenReview={() => setView('review')}
        />
      );
  }
}
