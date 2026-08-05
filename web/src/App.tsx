import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginScreen } from './auth/LoginScreen';
import { AppShell } from './screens/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { ProgramLibraryScreen } from './screens/ProgramLibraryScreen';
import { ProgramDetailScreen } from './screens/ProgramDetailScreen';
import { DayDetailScreen } from './screens/DayDetailScreen';
import { WizardScreen } from './screens/WizardScreen';
import { MoreScreen } from './screens/MoreScreen';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route path="/wizard" element={<WizardScreen />} />
            <Route element={<AppShell />}>
              <Route index element={<TodayScreen />} />
              <Route path="program" element={<ProgramLibraryScreen />} />
              <Route path="program/:id" element={<ProgramDetailScreen />} />
              <Route path="program/:id/day/:dayIndex" element={<DayDetailScreen />} />
              <Route path="more" element={<MoreScreen />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
