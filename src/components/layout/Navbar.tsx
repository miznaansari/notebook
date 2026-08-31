"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, User as UserIcon, Plus, Menu, X, CheckSquare, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NavbarProps {
  user: { id: string; name: string; email: string } | null;
  activeProject?: { id: string; name: string; clientName?: string | null; color?: string } | null;
  onNewProject?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export function Navbar({
  user,
  activeProject,
  onNewProject,
  onToggleSidebar,
  isSidebarOpen,
}: NavbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast.error("Failed to log out");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b-2 border-gray-200">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left side: Hamburger & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-md hover:bg-gray-100 text-gray-700 transition-transform duration-200 hover:scale-105"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/workspace" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-md bg-[#3B82F6] flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110">
              <BookOpen className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-gray-900 block leading-tight">
                NOTEPAD<span className="text-[#3B82F6]">.HUB</span>
              </span>
              <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block">
                Project & Meeting Notes
              </span>
            </div>
          </Link>

          {/* Active project breadcrumb */}
          {activeProject && (
            <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l-2 border-gray-200">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activeProject.color || "#3B82F6" }}
              />
              <span className="text-sm font-bold text-gray-900 truncate max-w-[200px]">
                {activeProject.name}
              </span>
              {activeProject.clientName && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-semibold truncate max-w-[150px]">
                  {activeProject.clientName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side: Actions & User */}
        <div className="flex items-center gap-3">
          {onNewProject && (
            <Button
              variant="primary"
              size="sm"
              onClick={onNewProject}
              className="hidden sm:inline-flex gap-1.5"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span>New Project</span>
            </Button>
          )}

          {user && (
            <div className="flex items-center gap-3 pl-2 border-l-2 border-gray-200">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-gray-900 leading-tight">
                  {user.name}
                </span>
                <span className="text-[11px] text-gray-500 font-medium truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>

              <div className="h-9 w-9 rounded-md bg-[#10B981] text-white flex items-center justify-center font-bold text-sm select-none">
                {user.name.charAt(0).toUpperCase()}
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Logout"
                className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 hover:scale-105"
              >
                <LogOut className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
