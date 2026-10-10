import awsSaaMeta from './aws-saa/meta.json'
import awsSaaC03Meta from './aws-saa-c03/meta.json'

export const exams = [
  {
    slug: 'aws-saa',
    meta: awsSaaMeta,
    loadQuestions: () => import('./aws-saa/questions.json'),
  },
  {
    slug: 'aws-saa-c03',
    meta: awsSaaC03Meta,
    loadQuestions: () => import('./aws-saa-c03/questions.json'),
  },
]

export function findExam(slug) {
  return exams.find(e => e.slug === slug) || null
}
