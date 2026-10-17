import { Progress } from '@/components/ui/progress';

function formatTime(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function QuizProgress({ current, total, stats, elapsedSeconds }) {
  const progressPercent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="mb-6">
      <Progress value={progressPercent} className="h-2 mb-3" />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Question {current + 1} of {total}</span>
        {elapsedSeconds != null && (
          <span className="font-mono">{formatTime(elapsedSeconds)}</span>
        )}
        <span>
          Score: {stats.correct}/{stats.answered}
          {stats.answered > 0 && ` (${stats.percentage}%)`}
        </span>
      </div>
    </div>
  );
}
