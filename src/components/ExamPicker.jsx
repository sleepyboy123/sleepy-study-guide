import { Link } from 'react-router-dom'
import { exams } from '@/data/exams'
import { getStorageKey } from '@/hooks/useQuizState'
import NavHeader from './NavHeader'

function getExamProgress(slug) {
  try {
    const raw = localStorage.getItem(getStorageKey(slug))
    if (!raw) return null
    const state = JSON.parse(raw)
    const answers = state.answers || {}
    const total = Object.keys(answers).length
    const correct = Object.values(answers).filter(a => a.correct).length
    return { answered: total, correct, rate: total > 0 ? Math.round((correct / total) * 100) : 0 }
  } catch {
    return null
  }
}

export default function ExamPicker() {
  return (
    <>
      <NavHeader />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-foreground mb-1">Choose an Exam</h2>
        <p className="text-sm text-muted-foreground mb-6">Select an exam to start studying</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exams.map(exam => {
            const progress = getExamProgress(exam.slug)
            return (
              <Link
                key={exam.slug}
                to={`/exam/${exam.slug}`}
                className="no-underline text-inherit"
              >
                <div className="bg-white border border-border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-white text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ backgroundColor: exam.meta.color }}
                    >
                      {exam.meta.provider}
                    </span>
                    <span className="font-semibold text-[15px] text-foreground">{exam.meta.name}</span>
                  </div>
                  <p className="text-muted-foreground text-[13px] mb-3">
                    {exam.meta.code} — {exam.meta.questionCount} questions
                  </p>
                  {progress ? (
                    <>
                      <div className="bg-muted rounded-md h-1.5 overflow-hidden mb-1.5">
                        <div
                          className="bg-green-500 h-full rounded-md transition-all"
                          style={{ width: `${Math.min((progress.answered / exam.meta.questionCount) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {progress.answered} answered — {progress.rate}% correct
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs">Not started</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
