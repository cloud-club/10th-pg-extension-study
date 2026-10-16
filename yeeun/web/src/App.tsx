import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashShell } from './components/layout/DashShell'
import { HomeDashboard } from './pages/Home'
import { Week02Doc } from './pages/week02/Doc'
import { Week02Lab } from './pages/week02/Lab'
import { Week03Doc } from './pages/week03/Doc'
import { Week03Lab } from './pages/week03/Lab'
import { Week04Doc } from './pages/week04/Doc'
import { Week04Lab } from './pages/week04/Lab'
import { Week05Doc } from './pages/week05/Doc'
import { Week05Lab } from './pages/week05/Lab'
import { Week06Doc } from './pages/week06/Doc'
import { Week06Lab } from './pages/week06/Lab'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<DashShell />}>
          <Route index element={<HomeDashboard />} />
          <Route path="week02" element={<Week02Doc />} />
          <Route path="week02/lab" element={<Week02Lab />} />
          <Route path="week03" element={<Week03Doc />} />
          <Route path="week03/lab" element={<Week03Lab />} />
          <Route path="week04" element={<Week04Doc />} />
          <Route path="week04/lab" element={<Week04Lab />} />
          <Route path="week05" element={<Week05Doc />} />
          <Route path="week05/lab" element={<Week05Lab />} />
          <Route path="week06" element={<Week06Doc />} />
          <Route path="week06/lab" element={<Week06Lab />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
