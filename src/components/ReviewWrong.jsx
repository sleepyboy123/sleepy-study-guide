import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import QuestionCard from './QuestionCard';
import Feedback from './Feedback';

export default function ReviewWrong() {
  const { quizState, questions } = useOutletContext();
  const navigate = useNavigate();
  const { answers } = quizState;

  const wrongQuestions = questions.filter(q => answers[q.id] && !answers[q.id].correct);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (wrongQuestions.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-4">No wrong answers to review</h2>
        <Button variant="secondary" onClick={() => navigate('..')}>Back to Dashboard</Button>
      </div>
    );
  }

  const question = wrongQuestions[currentIndex];
  const answer = answers[question.id];

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Reviewing Wrong Answers</h2>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} of {wrongQuestions.length}
        </span>
      </div>
      <QuestionCard
        key={question.id}
        question={question}
        onSubmit={() => {}}
        existingAnswer={answer}
      />
      <Feedback question={question} answer={answer} />
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(i => i - 1)}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          Previous
        </Button>
        {currentIndex < wrongQuestions.length - 1 ? (
          <Button
            onClick={() => setCurrentIndex(i => i + 1)}
            className="flex-1"
          >
            Next
          </Button>
        ) : (
          <Button onClick={() => navigate('..')} className="flex-1">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
