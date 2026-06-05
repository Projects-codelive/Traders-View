"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSession } from "@/lib/auth";
import {
  validateName, validatePhone, validateDOB,
  validateEmail, validatePassword, getPasswordStrength,
} from "@/lib/validators";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];

export default function RegisterPage() {
  const router = useRouter();
  const { session, loading, refresh } = useAuth();

  const [form, setForm] = useState({
    name: "",
    gender: "" as "male" | "female" | "other" | "",
    phone: "",
    dob: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [session, loading]);

  function set(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
    setErrors(p => ({ ...p, [field]: undefined, form: undefined }));
  }

  const maxDOB = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  })();

  const passwordStrength = getPasswordStrength(form.password);

  function validate(): boolean {
    const e: Record<string, string | undefined> = {};
    e.name = validateName(form.name) ?? undefined;
    if (!form.gender) e.gender = "Please select a gender.";
    e.phone = validatePhone(form.phone) ?? undefined;
    e.dob = validateDOB(form.dob) ?? undefined;
    e.email = validateEmail(form.email) ?? undefined;
    e.password = validatePassword(form.password) ?? undefined;
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    return Object.values(e).every(v => !v);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    try {
      const res = await axios.post("/api/auth/register", {
        name: form.name,
        gender: form.gender,
        phone: form.phone,
        dob: form.dob,
        email: form.email,
        password: form.password,
      });
      if (res.data.success) {
        saveSession(res.data.user);
        refresh();
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Registration failed. Please try again.";
      setErrors({ form: msg });
    }
    setSubmitting(false);
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-400 flex items-center justify-center gap-3">
            <img src="/logo3.png" alt="Play" className="w-50 rounded-lg" />
            {/* Play */}
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Create your free account — start with ₹100,000 virtual balance</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Create Account</h2>

          {errors.form && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-5">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Rahul Sharma"
                  className={inputClass(errors.name)}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Gender</label>
                <select
                  value={form.gender}
                  onChange={e => set("gender", e.target.value)}
                  className={inputClass(errors.gender) + " cursor-pointer"}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210"
                  maxLength={10}
                  className={inputClass(errors.phone)}
                />
                {errors.phone
                  ? <p className="text-red-400 text-xs mt-1">{errors.phone}</p>
                  : <p className="text-gray-600 text-xs mt-1">{form.phone.length}/10 digits</p>
                }
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={e => set("dob", e.target.value)}
                  max={maxDOB}
                  className={inputClass(errors.dob) + " cursor-pointer"}
                />
                {errors.dob
                  ? <p className="text-red-400 text-xs mt-1">{errors.dob}</p>
                  : <p className="text-gray-600 text-xs mt-1">Must be 18+ years old</p>
                }
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="yourname@gmail.com"
                className={inputClass(errors.email)}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Min 8 chars, 1 capital, 1 number, 1 special"
                  className={inputClass(errors.password) + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all ${i <= passwordStrength ? STRENGTH_COLORS[passwordStrength] : "bg-gray-700"}`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${STRENGTH_COLORS[passwordStrength].replace("bg-", "text-")}`}>
                    {STRENGTH_LABELS[passwordStrength]}
                  </p>
                </div>
              )}
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              {form.password.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {[
                    { ok: form.password.length >= 8, label: "At least 8 characters" },
                    { ok: /[A-Z]/.test(form.password), label: "One uppercase letter" },
                    { ok: /[0-9]/.test(form.password), label: "One number" },
                    { ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(form.password), label: "One special character" },
                  ].map(r => (
                    <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.ok ? "text-green-400" : "text-gray-600"}`}>
                      <span>{r.ok ? "✓" : "○"}</span> {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={e => set("confirmPassword", e.target.value)}
                placeholder="Re-enter password"
                className={inputClass(errors.confirmPassword)}
              />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition text-sm mt-2"
            >
              {submitting ? "Creating account…" : "Create Account — Get ₹100,000 Free"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/" className="text-green-400 hover:text-green-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function inputClass(error?: string) {
  return `w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 transition ${
    error
      ? "border-red-600 focus:ring-red-600/30"
      : "border-gray-700 focus:ring-green-500/30 focus:border-green-500"
  }`;
}
