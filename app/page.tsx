"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSession } from "@/lib/auth";
import { validateEmail, validatePassword } from "@/lib/validators";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [session, loading]);

  function validate(): boolean {
    const e: typeof errors = {};
    e.email = validateEmail(email) ?? undefined;
    e.password = validatePassword(password) ?? undefined;
    setErrors(e);
    return !e.email && !e.password;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      if (res.data.success) {
        saveSession(res.data.user);
        refresh();
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Login failed. Please try again.";
      setErrors({ form: msg });
    }
    setSubmitting(false);
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-400 flex items-center justify-center gap-3">
            <img src="/logo3.png" alt="Play" className="w-50 rounded-lg" />
            {/* Play */}
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Practice trading with ₹2,00,000 virtual money</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>

          {errors.form && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-5">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined, form: undefined })); }}
                placeholder="yourname@gmail.com"
                className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition
                  ${errors.email ? "border-red-600 focus:ring-red-600/30" : "border-gray-700 focus:ring-green-500/30 focus:border-green-500"}`}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined, form: undefined })); }}
                  placeholder="Enter your password"
                  className={`w-full bg-gray-800 border rounded-lg px-4 py-2.5 pr-10 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition
                    ${errors.password ? "border-red-600 focus:ring-red-600/30" : "border-gray-700 focus:ring-green-500/30 focus:border-green-500"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition text-sm"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-green-400 hover:text-green-300 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
