import { useState } from 'react';
import { cn } from '@/lib/utils';
import questionsData from '@/data/questions.json';
import { REVIEW_STATUS_KEY } from '@/hooks/useQuizState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ReviewQueue({ quizState, onExit }) {
  const { answers } = quizState;
  const [reviewStatus, setReviewStatus] = useState(() => {
    try {
      const stored = localStorage.getItem(REVIEW_STATUS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const flaggedQuestions = questionsData.filter(
    q => q.confidence !== 'high' || q.communityCorrection
  );

  function updateReviewStatus(id, status) {
    const next = { ...reviewStatus, [id]: status };
    setReviewStatus(next);
    localStorage.setItem(REVIEW_STATUS_KEY, JSON.stringify(next));
  }

  const verified = flaggedQuestions.filter(q => reviewStatus[q.id] === 'verified').length;
  const needsCorrection = flaggedQuestions.filter(q => reviewStatus[q.id] === 'needs-correction').length;
  const unreviewed = flaggedQuestions.length - verified - needsCorrection;

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Review Queue</h1>
        <Button variant="secondary" onClick={onExit}>Back to Dashboard</Button>
      </div>

      <div className="flex gap-4 mb-5 text-sm text-muted-foreground">
        <span>{flaggedQuestions.length} flagged</span>
        <span>{verified} verified</span>
        <span>{needsCorrection} needs correction</span>
        <span>{unreviewed} unreviewed</span>
      </div>

      <div className="flex flex-col gap-4">
        {flaggedQuestions.map(q => {
          const answer = answers[q.id];
          const status = reviewStatus[q.id];
          return (
            <Card
              key={q.id}
              className={cn(
                'border-l-4',
                status === 'verified' && 'border-l-green-500',
                status === 'needs-correction' && 'border-l-red-500',
                !status && 'border-l-muted'
              )}
            >
              <CardContent className="pt-5">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="default">Q{q.id}</Badge>
                  <Badge variant="secondary">{q.category}</Badge>
                  <Badge variant="outline">{q.confidence}</Badge>
                  {q.communityCorrection && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      community-corrected
                    </Badge>
                  )}
                </div>
                <p className="text-sm leading-6 mb-3">{q.question}</p>
                <div className="mb-3 space-y-1">
                  {q.options.map(opt => (
                    <div
                      key={opt.key}
                      className={cn(
                        'text-sm px-2.5 py-1.5 rounded',
                        q.correctAnswer.includes(opt.key) && 'bg-green-50'
                      )}
                    >
                      <strong>{opt.key}.</strong> {opt.text}
                    </div>
                  ))}
                </div>
                <p className="text-sm mb-2">
                  <span className="font-semibold">Answer:</span> {q.correctAnswer.join(', ')}
                  {answer && (
                    <span className={answer.correct ? 'text-green-600' : 'text-red-600'}>
                      {' '}(you answered: {answer.selected.join(', ')})
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mb-3">{q.explanation}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={status === 'verified' ? 'default' : 'outline'}
                    onClick={() => updateReviewStatus(q.id, 'verified')}
                  >
                    Verified
                  </Button>
                  <Button
                    size="sm"
                    variant={status === 'needs-correction' ? 'destructive' : 'outline'}
                    onClick={() => updateReviewStatus(q.id, 'needs-correction')}
                  >
                    Needs Correction
                  </Button>
                  {status && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateReviewStatus(q.id, undefined)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
