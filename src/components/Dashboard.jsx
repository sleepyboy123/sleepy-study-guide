import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function Dashboard() {
  const { quizState, questions: questionsData, exam, slug } = useOutletContext();
  const navigate = useNavigate();
  const { stats, categories, answers, settings, updateSettings, resetQuiz } = quizState;

  const categoryStats = categories.map(([cat, total]) => {
    const catQuestions = questionsData.filter(q => q.category === cat);
    const answered = catQuestions.filter(q => answers[q.id]).length;
    const correct = catQuestions.filter(q => answers[q.id]?.correct).length;
    return { cat, total, answered, correct };
  });

  return (
    <div className="max-w-4xl mx-auto p-5">
      <h1 className="text-3xl font-bold mb-5">{exam.meta.name} Quiz</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { value: `${stats.answered}/${stats.total}`, label: 'Questions Answered' },
          { value: `${stats.percentage}%`, label: 'Correct Rate' },
          { value: stats.correct, label: 'Correct' },
          { value: stats.incorrect, label: 'Incorrect' },
        ].map(({ value, label }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-primary">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Button variant="outline" onClick={() => navigate('quiz')}>
          {stats.answered > 0 ? 'Continue Quiz' : 'Start Quiz'}
        </Button>
        {stats.answered > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700 text-white">Reset Progress</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all your answers and start fresh. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetQuiz}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="shuffle"
              checked={settings.shuffleQuestions}
              onCheckedChange={checked => updateSettings({ shuffleQuestions: checked })}
            />
            <label htmlFor="shuffle" className="text-sm">Shuffle questions</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="unanswered"
              checked={settings.showOnlyUnanswered}
              onCheckedChange={checked => updateSettings({ showOnlyUnanswered: checked })}
            />
            <label htmlFor="unanswered" className="text-sm">Show only unanswered</label>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Category:</label>
              <Select
                value={settings.filterCategory || 'all'}
                onValueChange={val => updateSettings({ filterCategory: val === 'all' ? null : val })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(([cat, count]) => (
                    <SelectItem key={cat} value={cat}>{cat} ({count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryStats.map(({ cat, total, answered, correct }) => (
              <div key={cat} className="grid grid-cols-[140px_100px_1fr] items-center gap-3">
                <span className="text-sm font-medium truncate">{cat}</span>
                <span className="text-xs text-muted-foreground text-right">
                  {answered}/{total}
                  {answered > 0 && ` (${Math.round((correct / answered) * 100)}%)`}
                </span>
                <Progress value={(answered / total) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
