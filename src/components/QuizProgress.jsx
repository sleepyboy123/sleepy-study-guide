import { Progress } from '@/components/ui/progress';

export default function QuizProgress({ current, total, stats }) {
  // Only show 100% once all questions have been answered, not just navigated to
  const progressPercent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="mb-5">
      <Progress value={progressPercent} className="h-1.5 mb-2" />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Question {current + 1} of {total}</span>
        <span>
          Score: {stats.correct}/{stats.answered}
          {stats.answered > 0 && ` (${stats.percentage}%)`}
        </span>
      </div>
    </div>
  );
}
