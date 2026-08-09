import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { LoginScreen } from './auth/LoginScreen';
import { AppShell } from './screens/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { ProgramLibraryScreen } from './screens/ProgramLibraryScreen';
import { ProgramDetailScreen } from './screens/ProgramDetailScreen';
import { DayDetailScreen } from './screens/DayDetailScreen';
import { LiftDetailScreen } from './screens/LiftDetailScreen';
import { WizardScreen } from './screens/WizardScreen';
import { MoreScreen } from './screens/MoreScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { Toaster } from './ui/toast';
import { OfflinePill } from './ui/OfflinePill';
import { UpdateToast } from './ui/UpdateToast';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflinePill />
        <Toaster />
        <UpdateToast />
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route path="/wizard" element={<WizardScreen />} />
            <Route element={<AppShell />}>
              <Route index element={<TodayScreen />} />
              <Route path="program" element={<ProgramLibraryScreen />} />
              <Route path="program/:id" element={<ProgramDetailScreen />} />
              <Route path="program/:id/day/:dayIndex" element={<DayDetailScreen />} />
              <Route path="program/:id/day/:dayIndex/lift/:order" element={<LiftDetailScreen />} />
              <Route path="more" element={<MoreScreen />} />
              <Route path="more/history" element={<HistoryScreen />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
