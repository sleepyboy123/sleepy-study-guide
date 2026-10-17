import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QuestionCard from './QuestionCard';
import Feedback from './Feedback';

function truncate(text, maxLen = 100) {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export default function ReviewWrong() {
  const { quizState, questions } = useOutletContext();
  const navigate = useNavigate();
  const { answers } = quizState;

  const wrongQuestions = questions.filter(q => answers[q.id] && !answers[q.id].correct);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  const wrongCategories = useMemo(() => {
    const counts = {};
    wrongQuestions.forEach(q => { counts[q.category] = (counts[q.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [wrongQuestions]);

  const filteredWrong = useMemo(() => {
    if (filterCategory === 'all') return wrongQuestions;
    return wrongQuestions.filter(q => q.category === filterCategory);
  }, [wrongQuestions, filterCategory]);

  if (wrongQuestions.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-4">No wrong answers to review</h2>
        <Button variant="secondary" onClick={() => navigate('..')}>Back to Dashboard</Button>
      </div>
    );
  }

  if (selectedIndex !== null) {
    const question = filteredWrong[selectedIndex];
    const answer = answers[question.id];
    const questionNumber = questions.indexOf(question) + 1;

    return (
      <div className="max-w-4xl mx-auto p-5">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => setSelectedIndex(null)}>
            ← Back to list
          </Button>
          <span className="text-sm text-muted-foreground">
            Q{questionNumber} — {selectedIndex + 1} of {filteredWrong.length} wrong
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
            onClick={() => setSelectedIndex(i => i - 1)}
            disabled={selectedIndex === 0}
            className="flex-1"
          >
            Previous
          </Button>
          {selectedIndex < filteredWrong.length - 1 ? (
            <Button
              onClick={() => setSelectedIndex(i => i + 1)}
              className="flex-1"
            >
              Next
            </Button>
          ) : (
            <Button onClick={() => setSelectedIndex(null)} className="flex-1">
              Back to list
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Wrong Answers ({wrongQuestions.length})</h2>
        <Button variant="secondary" onClick={() => navigate('..')}>Back to Dashboard</Button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium">Filter:</label>
        <Select
          value={filterCategory}
          onValueChange={val => { setFilterCategory(val); setSelectedIndex(null); }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            <SelectItem value="all">All categories ({wrongQuestions.length})</SelectItem>
            {wrongCategories.map(([cat, count]) => (
              <SelectItem key={cat} value={cat}>{cat} ({count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        {filteredWrong.map((q, idx) => {
          const questionNumber = questions.indexOf(q) + 1;
          return (
            <Card
              key={q.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => setSelectedIndex(idx)}
            >
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <Badge variant="outline" className="shrink-0 mt-0.5">
                  Q{questionNumber}
                </Badge>
                <Badge variant="secondary" className="shrink-0 mt-0.5">
                  {q.category}
                </Badge>
                <span className="text-sm leading-relaxed">
                  {truncate(q.question)}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
