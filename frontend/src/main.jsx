import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ResultsPage from './ResultsPage.jsx'
import LoginPage from './LoginPage.jsx'
import JobHistoryPage from './JobHistoryPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/history" element={<JobHistoryPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
