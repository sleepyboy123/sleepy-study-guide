import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './components/App';
import './index.css';

const legacyMigrations = [
  ['aws-saa-quiz-state', 'sleepy-aws-saa-quiz-state'],
]
for (const [oldKey, newKey] of legacyMigrations) {
  const data = localStorage.getItem(oldKey)
  if (data && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, data)
    localStorage.removeItem(oldKey)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
