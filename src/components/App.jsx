import { Routes, Route, Navigate } from 'react-router-dom'
import ExamPicker from './ExamPicker'
import ExamLayout from './ExamLayout'
import Dashboard from './Dashboard'
import Quiz from './Quiz'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ExamPicker />} />
      <Route path="/exam/:slug" element={<ExamLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="quiz" element={<Quiz />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
