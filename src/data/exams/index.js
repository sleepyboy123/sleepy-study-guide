import awsSaaMeta from './aws-saa/meta.json'

export const exams = [
  {
    slug: 'aws-saa',
    meta: awsSaaMeta,
    loadQuestions: () => import('./aws-saa/questions.json'),
  },
]

export function findExam(slug) {
  return exams.find(e => e.slug === slug) || null
}
