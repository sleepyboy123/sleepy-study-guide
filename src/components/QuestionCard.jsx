import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function QuestionCard({ question, onSubmit, existingAnswer }) {
  const [selected, setSelected] = useState(existingAnswer?.selected || []);
  const submitted = !!existingAnswer;
  const requiredSelections = question.isMultiSelect ? question.correctAnswer.length : 1;

  function handleOptionClick(key) {
    if (submitted) return;
    if (question.isMultiSelect) {
      setSelected(prev =>
        prev.includes(key)
          ? prev.filter(k => k !== key)
          : prev.length < requiredSelections
            ? [...prev, key]
            : prev
      );
    } else {
      setSelected([key]);
    }
  }

  function handleSubmit() {
    if (selected.length === requiredSelections && !submitted) {
      onSubmit(question.id, selected);
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <p className="text-base leading-8 mb-6 tracking-wide">{question.question}</p>
        {question.isMultiSelect && (
          <Badge variant="secondary" className="mb-4">
            Select {requiredSelections} answers
          </Badge>
        )}
        <div className="flex flex-col gap-3 mb-4">
          {question.options.map(opt => {
            const isSelected = selected.includes(opt.key);
            const isCorrect = submitted && question.correctAnswer.includes(opt.key);
            const isWrong = submitted && isSelected && !isCorrect;
            return (
              <button
                key={opt.key}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors',
                  'bg-muted/50 border-transparent',
                  !submitted && 'hover:bg-accent hover:border-accent',
                  isSelected && !submitted && 'bg-accent border-primary',
                  isCorrect && 'bg-green-50 border-green-500',
                  isWrong && 'bg-red-50 border-red-500',
                  submitted && 'cursor-default'
                )}
                onClick={() => handleOptionClick(opt.key)}
                disabled={submitted}
                data-option={opt.key}
              >
                <span className="font-bold min-w-[28px] text-muted-foreground text-base">{opt.key}.</span>
                <span className="flex-1 leading-7 tracking-wide">{opt.text}</span>
              </button>
            );
          })}
        </div>
        {!submitted && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={selected.length !== requiredSelections}
            data-submit
          >
            Submit Answer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
