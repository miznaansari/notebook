"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/workspace";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Welcome back!");
        router.push(redirectPath);
        router.refresh();
      } else {
        toast.error(data.error || "Invalid credentials");
      }
    } catch (err) {
      toast.error("Login failed. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setEmail("admin@notepad.dev");
    setPassword("password123");
  };

  return (
    <div className="bg-white py-8 px-6 sm:px-10 rounded-xl border-2 border-gray-200">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isLoading}
          className="w-full mt-2 gap-2 text-sm"
        >
          <span>{isLoading ? "Signing in..." : "Sign In to Workspace"}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      {/* Quick Demo Hint */}
      <div className="mt-6 pt-6 border-t-2 border-gray-100 text-center">
        <p className="text-xs text-gray-500 font-medium mb-2">
          New here or want a fast test?
        </p>
        <button
          type="button"
          onClick={fillDemoAccount}
          className="text-xs font-bold text-[#3B82F6] hover:underline cursor-pointer"
        >
          Fill Sample Credentials (admin@notepad.dev)
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="h-12 w-12 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110">
            <BookOpen className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-gray-900">
            NOTEPAD<span className="text-[#3B82F6]">.HUB</span>
          </span>
        </Link>
        <h2 className="mt-4 text-2xl font-extrabold text-gray-900 tracking-tight">
          Sign in to your Workspace
        </h2>
        <p className="mt-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          30-Day Persistent Secure Session
        </p>
      </div>

      {/* Form Card wrapped in Suspense */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <React.Suspense
          fallback={
            <div className="bg-white py-12 px-6 rounded-xl border-2 border-gray-200 text-center text-xs font-bold text-gray-500">
              Loading login form...
            </div>
          }
        >
          <LoginForm />
        </React.Suspense>

        {/* Footer Link */}
        <p className="mt-6 text-center text-xs font-bold text-gray-600">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="text-[#3B82F6] hover:underline font-extrabold"
          >
            Create an account free
          </Link>
        </p>
      </div>
    </div>
  );
}
