/** Định tuyến. Student: /student/..., Operator: /operator/... Sai vai trò sẽ bị chuyển hướng. */
import { Navigate, Route, Routes } from "react-router-dom";
import { RoleRoute, homePathFor } from "./components/RoleRoute";
import { Spinner } from "./components/Spinner";
import { useAuth } from "./context/AuthContext";
import { OperatorLayout } from "./layouts/OperatorLayout";
import { StudentLayout } from "./layouts/StudentLayout";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ChargingIncidentPage } from "./pages/operator/ChargingIncidentPage";
import { MonitoringPage } from "./pages/operator/MonitoringPage";
import { RedistributionPage } from "./pages/operator/RedistributionPage";
import { SimulationPage } from "./pages/operator/SimulationPage";
import { ActiveTripPage } from "./pages/student/ActiveTripPage";
import { ChargingRequestPage } from "./pages/student/ChargingRequestPage";
import { HomePage } from "./pages/student/HomePage";
import { MyReservationsPage } from "./pages/student/MyReservationsPage";
import { MyVehiclePage } from "./pages/student/MyVehiclePage";
import { ReserveVehiclePage } from "./pages/student/ReserveVehiclePage";
import { SettingsPage } from "./pages/student/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RoleRoute role="STUDENT" />}>
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<HomePage />} />
          <Route path="hubs/:hubId/reserve" element={<ReserveVehiclePage />} />
          <Route path="trips" element={<ActiveTripPage />} />
          <Route path="my-vehicle" element={<MyVehiclePage />} />
          <Route path="charging-request" element={<ChargingRequestPage />} />
          <Route path="reservations" element={<MyReservationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route element={<RoleRoute role="OPERATOR" />}>
        <Route path="/operator" element={<OperatorLayout />}>
          <Route index element={<Navigate to="monitoring" replace />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="charging-incidents" element={<ChargingIncidentPage />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="redistribution" element={<RedistributionPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}
