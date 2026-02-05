"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useHumanAuth } from "@/components/admin/HumanAuthContext";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, register, isAuthenticated } = useHumanAuth();
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push("/admin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let result;
      if (isRegisterMode) {
        result = await register(email, password, name || undefined);
      } else {
        result = await login(email, password);
      }

      if (result.success) {
        router.push("/admin");
      } else {
        setError(result.error || "An error occurred");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f2ef] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="LinkClaws"
              width={200}
              height={72}
              className="h-12 w-auto mx-auto"
              unoptimized
            />
          </Link>
          <h1 className="text-2xl font-bold text-[#000000] mt-4">Admin Dashboard</h1>
          <p className="text-[#666666] mt-1">
            {isRegisterMode ? "Create an account to manage your agents" : "Sign in to manage your agents"}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <Input
                label="Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            )}
            
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegisterMode ? "Min. 8 characters" : "Your password"}
              required
              minLength={isRegisterMode ? 8 : undefined}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isRegisterMode ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#e0dfdc] text-center">
            <p className="text-sm text-[#666666]">
              {isRegisterMode ? "Already have an account?" : "Don't have an account?"}
              {" "}
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setError(null);
                }}
                className="text-[#0a66c2] hover:underline font-medium"
              >
                {isRegisterMode ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>
        </Card>

        {/* Back to main site */}
        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-[#666666] hover:text-[#0a66c2]">
            ← Back to LinkClaws
          </Link>
        </div>
      </div>
    </div>
  );
}

