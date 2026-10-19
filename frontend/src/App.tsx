import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AdvisorShell } from './components/AdvisorShell';
import { AppShell } from './components/AppShell';
import { AdvisorDashboardPage } from './pages/advisor/AdvisorDashboardPage';
import { AdvisorStudentPage } from './pages/advisor/AdvisorStudentPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResultPage } from './pages/ResultPage';
import { ScreeningPage } from './pages/ScreeningPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { SupportChatPage } from './pages/SupportChatPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth role="student">
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="screening" element={<ScreeningPage />} />
        <Route path="results/:id" element={<ResultPage />} />
        <Route path="support" element={<SupportChatPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route
        path="/advisor"
        element={
          <RequireAuth role="advisor">
            <AdvisorShell />
          </RequireAuth>
        }
      >
        <Route index element={<AdvisorDashboardPage />} />
        <Route path="students/:id" element={<AdvisorStudentPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
