"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Account created successfully with starter project!");
        router.push("/workspace");
        router.refresh();
      } else {
        toast.error(data.error || "Failed to create account");
      }
    } catch (err) {
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
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
          Create your Free Account
        </h2>
        <p className="mt-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Includes starter client project & requirement templates
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-xl border-2 border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password (min 6 characters)"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="emerald"
              size="lg"
              disabled={isLoading}
              className="w-full mt-2 gap-2 text-sm"
            >
              <span>{isLoading ? "Creating Account..." : "Get Started Now"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t-2 border-gray-100 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span>Freeform Notepad with continuous auto-save</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span>Structured Client Q&A tracking with statuses</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span>Next Meeting Agenda & Question preparation</span>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-bold text-gray-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#3B82F6] hover:underline font-extrabold"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
