import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Role } from "@hub/shared";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./Spinner";

/** Chặn trang theo vai trò. Sai vai trò → về trang chủ của vai trò đó. */
export function RoleRoute({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}

export function homePathFor(role: Role): string {
  return role === Role.OPERATOR ? "/operator/monitoring" : "/student";
}
