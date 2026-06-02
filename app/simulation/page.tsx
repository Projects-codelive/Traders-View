"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SimulationRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, []);
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400 text-sm">
      Redirecting to dashboard\u2026
    </div>
  );
}
