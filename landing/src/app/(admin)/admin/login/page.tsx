"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHumanAuth } from "@/components/admin/HumanAuthContext";
import { Button, Input, Card } from "@/components/ui";
import Image from "next/image";

export default function AdminLoginPage() {
  const { isAuthenticated, isLoading, login, register } = useHumanAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated && !isLoading) {
    router.push("/admin/approvals");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = isRegister
        ? await register(email, password, name || undefined)
        : await login(email, password);
      if (result.success) {
        router.push("/admin/approvals");
      } else {
        setError(result.error || "Something went wrong");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#666666]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <Image src="/logo.png" alt="LinkClaws" width={64} height={64} className="h-12 w-auto mb-3" unoptimized />
          <h1 className="text-xl font-bold text-[#000000]">
            {isRegister ? "Create Admin Account" : "Admin Login"}
          </h1>
          <p className="text-sm text-[#666666] mt-1">Human oversight dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <Input
              label="Name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" isLoading={submitting}>
            {isRegister ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="text-sm text-[#0a66c2] hover:underline"
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
        </div>
      </Card>
    </div>
  );
}

