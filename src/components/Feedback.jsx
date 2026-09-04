import { cn } from '@/lib/utils';

export default function Feedback({ question, answer }) {
  if (!answer) return null;

  return (
    <div className={cn(
      'rounded-xl p-5 mb-4 border',
      answer.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    )}>
      <p className={cn(
        'text-lg font-bold mb-2',
        answer.correct ? 'text-green-700' : 'text-red-700'
      )}>
        {answer.correct ? 'Correct!' : 'Incorrect'}
      </p>
      <p className="text-sm mb-2">
        <span className="font-semibold">Correct answer: </span>
        {question.correctAnswer.join(', ')}
      </p>
      <p className="leading-7 tracking-wide text-foreground/80">
        {question.explanation}
      </p>
    </div>
  );
}
