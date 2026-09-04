import { useState, useEffect } from 'react'
import { useParams, Navigate, Outlet } from 'react-router-dom'
import { findExam } from '@/data/exams'
import useQuizState from '@/hooks/useQuizState'
import NavHeader from './NavHeader'

function ExamContent({ slug, exam, questions }) {
  const quizState = useQuizState(slug, questions)
  return (
    <>
      <NavHeader examName={exam.meta.name} />
      <Outlet context={{ quizState, questions, exam, slug }} />
    </>
  )
}

export default function ExamLayout() {
  const { slug } = useParams()
  const exam = findExam(slug)
  const [questions, setQuestions] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!exam) return
    setQuestions(null)
    setError(null)
    let cancelled = false
    exam.loadQuestions()
      .then(mod => {
        if (!cancelled) setQuestions(mod.default)
      })
      .catch(err => {
        if (!cancelled) setError(err)
      })
    return () => { cancelled = true }
  }, [exam])

  if (!exam) return <Navigate to="/" replace />

  if (error) {
    return (
      <>
        <NavHeader />
        <div className="flex flex-col items-center gap-4 p-16">
          <p className="text-destructive font-medium">Failed to load questions</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </>
    )
  }

  if (!questions) {
    return (
      <>
        <NavHeader />
        <div className="flex justify-center p-16">
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </>
    )
  }

  return <ExamContent key={slug} slug={slug} exam={exam} questions={questions} />
}
