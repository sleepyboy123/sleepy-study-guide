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

  useEffect(() => {
    if (!exam) return
    let cancelled = false
    exam.loadQuestions().then(mod => {
      if (!cancelled) setQuestions(mod.default)
    })
    return () => { cancelled = true }
  }, [exam])

  if (!exam) return <Navigate to="/" replace />

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

  return <ExamContent slug={slug} exam={exam} questions={questions} />
}
