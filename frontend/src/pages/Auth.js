import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "@/context/AuthContext";
import { Loader2, Hash, MessageSquare, Zap } from "lucide-react";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
        <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-xl font-bold font-display text-slate-900 tracking-tight">CollabSphere</span>
    </div>
  );
}

export function AuthShell({ children, title, subtitle }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] bg-indigo-600 p-12 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-500/40 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold font-display tracking-tight">CollabSphere</span>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold font-display leading-tight">
            Where student teams<br />ship together.
          </h1>
          <p className="text-indigo-100 text-lg max-w-sm">
            Real-time channels, direct messages, files and presence — built for hackathons, projects and dev crews.
          </p>
          <div className="space-y-3 pt-2">
            {[
              [Hash, "Public & private channels"],
              [Zap, "Instant real-time messaging"],
              [MessageSquare, "Direct messages & presence"],
            ].map(([Icon, label], i) => (
              <div key={i} className="flex items-center gap-3 text-indigo-50">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-indigo-200">© {new Date().getFullYear()} CollabSphere</div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Brand />
          </div>
          <h2 className="text-3xl font-bold font-display text-slate-900">{title}</h2>
          <p className="text-slate-500 mt-1.5 mb-8">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = () => {
    setEmail("atanu@collabsphere.com");
    setPassword("password123");
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your workspaces">
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</label>
          <input
            data-testid="login-email-input"
            type="email"
            className={inputCls}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
          <input
            data-testid="login-password-input"
            type="password"
            className={inputCls}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div data-testid="login-error" className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <button
          data-testid="login-submit-button"
          type="button"
          onClick={submit}
          disabled={loading}
          className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Sign in
        </button>
      </form>
      <button
        onClick={quickFill}
        data-testid="login-demo-fill"
        className="mt-3 w-full text-xs text-slate-500 hover:text-indigo-600 transition-colors"
      >
        Use demo account (Atanu)
      </button>
      <p className="mt-6 text-sm text-slate-500 text-center">
        New to CollabSphere?{" "}
        <Link to="/register" data-testid="go-to-register" className="text-indigo-600 font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start collaborating in minutes">
      <form onSubmit={submit} className="space-y-4" data-testid="register-form">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Full name</label>
          <input data-testid="register-name-input" className={inputCls} placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</label>
          <input data-testid="register-email-input" type="email" className={inputCls} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
            <input data-testid="register-password-input" type="password" className={inputCls} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Confirm</label>
            <input data-testid="register-confirm-input" type="password" className={inputCls} placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
        </div>
        {error && (
          <div data-testid="register-error" className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <button data-testid="register-submit-button" type="button" onClick={submit} disabled={loading} className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Create account
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-500 text-center">
        Already have an account?{" "}
        <Link to="/login" data-testid="go-to-login" className="text-indigo-600 font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
