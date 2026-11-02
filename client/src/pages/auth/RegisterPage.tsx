// Owner: Bùi Quang Nhân – Register Student Account
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { ErrorMessage } from "../../components/ErrorMessage";
import { homePathFor } from "../../components/RoleRoute";
import { useAuth } from "../../context/AuthContext";
import { AuthShell } from "./AuthShell";

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError(new Error("Mật khẩu nhập lại không khớp."));
      return;
    }
    setSubmitting(true);
    try {
      await register({ fullName: form.fullName, email: form.email, password: form.password });
      navigate("/student", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Đăng ký" subtitle="Tạo tài khoản sinh viên để bắt đầu sử dụng.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="label">
            Họ và tên
          </label>
          <input id="fullName" required className="input" value={form.fullName} onChange={set("fullName")} />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" required className="input" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Mật khẩu (tối thiểu 6 ký tự)
          </label>
          <input
            id="password"
            type="password"
            minLength={6}
            required
            autoComplete="new-password"
            className="input"
            value={form.password}
            onChange={set("password")}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Nhập lại mật khẩu
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            className="input"
            value={form.confirm}
            onChange={set("confirm")}
          />
        </div>
        <ErrorMessage error={error} />
        <Button type="submit" fullWidth loading={submitting}>
          Tạo tài khoản
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-neutral-500">
        Đã có tài khoản?{" "}
        <Link to="/login" className="font-semibold text-brand underline-offset-2 hover:underline dark:text-lime">
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
