// Owner: Bùi Quang Nhân – Sign In
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { ErrorMessage } from "../../components/ErrorMessage";
import { homePathFor } from "../../components/RoleRoute";
import { useAuth } from "../../context/AuthContext";
import { AuthShell } from "./AuthShell";

const DEMO_ACCOUNTS = import.meta.env.DEV ? [
  { label: "Sinh viên", email: "student1@hub.local", password: "student123" },
  { label: "Vận hành", email: "operator@hub.local", password: "operator123" },
] : [];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homePathFor(u.role), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Đăng nhập" subtitle="Thuê xe, đặt chỗ đỗ và lịch sạc trong khu ĐHQG-HCM.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorMessage error={error} />
        <Button type="submit" fullWidth loading={submitting}>
          Đăng nhập
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="font-semibold text-brand underline-offset-2 hover:underline dark:text-lime">
          Đăng ký sinh viên
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="mt-8 rounded-xl border border-neutral-200 p-3 text-xs dark:border-white/10">
          <p className="mb-2 font-semibold text-neutral-600 dark:text-neutral-300">Tài khoản demo</p>
          <div className="flex gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
                className="flex-1 rounded-lg bg-neutral-100 px-2 py-2 font-medium hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
