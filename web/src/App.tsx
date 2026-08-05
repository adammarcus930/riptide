import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginScreen } from './auth/LoginScreen';
import { AppShell } from './screens/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { ProgramScreen } from './screens/ProgramScreen';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<TodayScreen />} />
              <Route path="program" element={<ProgramScreen />} />
              <Route path="more" element={<div className="p-6 text-ink">More (Task 5)</div>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
