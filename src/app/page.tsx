import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  HelpCircle,
  Calendar,
  CheckSquare,
  ArrowRight,
  Sparkles,
  Layers,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white border-b-2 border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#3B82F6] flex items-center justify-center text-white">
              <BookOpen className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-gray-900">
              NOTEPAD<span className="text-[#3B82F6]">.HUB</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="md" className="text-xs uppercase tracking-wider">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="md" className="text-xs uppercase tracking-wider gap-1.5">
                <span>Start Free</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section: Bold Primary Blue Poster Block */}
      <section className="relative bg-[#3B82F6] text-white overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        {/* Flat Geometric Background Accents */}
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rotate-45 bg-white/5 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/15 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-none">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Personal Project Notebook & Meeting Management System</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
            Notes, Client Q&A, and Meeting Prep in One Clean Workspace.
          </h1>

          <p className="text-base sm:text-xl text-blue-100 font-medium max-w-3xl mx-auto leading-relaxed">
            Stop losing client requirements across messy chats and lost docs. Write freely in continuous notepads, track questions with live status pills, and walk into every meeting prepared.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/register" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto h-14 px-8 rounded-md bg-white text-[#111827] hover:bg-gray-100 font-bold text-base transition-all duration-200 hover:scale-105 select-none cursor-pointer flex items-center justify-center gap-2">
                <span>Create Workspace</span>
                <ArrowRight className="w-4 h-4 text-[#3B82F6]" strokeWidth={3} />
              </button>
            </Link>

            <Link href="/login" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto h-14 px-8 rounded-md border-4 border-white text-white hover:bg-white hover:text-[#3B82F6] font-bold text-base transition-all duration-200 hover:scale-105 select-none cursor-pointer">
                Sign In to Existing Account
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Multi-Color Stats Section */}
      <section className="bg-white border-b-2 border-gray-200 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#EFF6FF] p-6 rounded-lg text-left">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#3B82F6]">100%</span>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-1">
              Data Isolation
            </p>
            <p className="text-xs text-gray-500 mt-0.5">User-specific MySQL security</p>
          </div>

          <div className="bg-[#ECFDF5] p-6 rounded-lg text-left">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#10B981]">30 Days</span>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-1">
              JWT Session
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Persistent authentication</p>
          </div>

          <div className="bg-[#FFFBEB] p-6 rounded-lg text-left">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#F59E0B]">4 Stages</span>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-1">
              Question Lifecycle
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Pending, Asked, Answered, Follow-up</p>
          </div>

          <div className="bg-[#FAF5FF] p-6 rounded-lg text-left">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#8B5CF6]">1-Click</span>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-1">
              Agenda Templates
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Instant requirements import</p>
          </div>
        </div>
      </section>

      {/* Core Modules Grid (Flat Color Blocks) */}
      <section className="bg-[#F3F4F6] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Designed for Project Clarity, Not Chat Clutter.
            </h2>
            <p className="text-sm sm:text-base font-medium text-gray-600 mt-2">
              Everything you need to capture, organize, and execute client projects seamlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Notepad */}
            <div className="bg-white p-8 rounded-lg transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-full bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center mb-6">
                  <FileText className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Continuous Notepad
                </h3>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mt-2 leading-relaxed">
                  A large distraction-free text editor that automatically saves every keystroke to MySQL. Organize multiple note sheets, code snippets, and client briefs per project.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs font-bold text-[#3B82F6]">
                <span>Markdown & Pinning Support</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 2: Questions & Answers */}
            <div className="bg-white p-8 rounded-lg transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-full bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center mb-6">
                  <HelpCircle className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Client Q&A Matrix
                </h3>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mt-2 leading-relaxed">
                  Track every crucial client question (Roles, Payments, Reports, Offline mode). Filter by status (Pending, Asked, Answered, Need Follow-up) and record threaded answers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs font-bold text-[#F59E0B]">
                <span>Status Lifecycle & Categories</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Feature 3: Meeting Prep */}
            <div className="bg-white p-8 rounded-lg transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mb-6">
                  <Calendar className="w-7 h-7" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Meeting Agenda & Minutes
                </h3>
                <p className="text-xs sm:text-sm font-medium text-gray-600 mt-2 leading-relaxed">
                  Curate what to ask next meeting, load standard discovery templates with 1-click, record call minutes, and automatically convert decisions into follow-up tasks.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs font-bold text-[#10B981]">
                <span>1-Click Agenda & PDF Export</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="bg-[#111827] text-white py-16 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Ready to organize your next client meeting?
          </h2>
          <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto">
            Experience the clean, focused project notebook designed to turn client discussions into structured project clarity.
          </p>
          <div className="pt-2">
            <Link href="/register">
              <button className="h-14 px-8 rounded-md bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold text-base transition-all duration-200 hover:scale-105 select-none cursor-pointer">
                Get Started Free — Open Workspace
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Clean Flat Footer */}
      <footer className="bg-white border-t-2 border-gray-200 py-8 px-4 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#3B82F6] text-white flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <span className="text-gray-900 font-extrabold">NOTEPAD.HUB</span>
            <span>— Personal Project Notebook & Meeting Management</span>
          </div>
          <p>© 2026. Built with Next.js, Prisma, MySQL & Flat Design System.</p>
        </div>
      </footer>
    </div>
  );
}
