"use client";

import * as React from "react";
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  FileText,
  Trash2,
  Edit,
  Save,
  HelpCircle,
  CheckSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIMagicButton } from "@/components/ui/ai-magic-button";
import { VoiceMicButton } from "@/components/ui/voice-mic-button";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { toast } from "sonner";

export interface MeetingItem {
  id: string;
  title: string;
  meetingDate: string;
  purpose?: string | null;
  location?: string | null;
  attendees?: string | null;
  notes?: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  meetingQuestions?: {
    question: {
      id: string;
      title: string;
      category: string;
      status: string;
    };
  }[];
  tasks?: any[];
  createdAt: string;
}

interface MeetingsModuleProps {
  projectId: string;
  meetings: MeetingItem[];
  questions: any[];
  onMeetingsChange: (updated: MeetingItem[]) => void;
  preSelectedQuestionIds?: string[];
}

export function MeetingsModule({
  projectId,
  meetings,
  questions,
  onMeetingsChange,
  preSelectedQuestionIds = [],
}: MeetingsModuleProps) {
  const [isNewModalOpen, setIsNewModalOpen] = React.useState(false);
  const [editingMeetingId, setEditingMeetingId] = React.useState<string | null>(null);

  // Form state
  const [title, setTitle] = React.useState("");
  const [meetingDate, setMeetingDate] = React.useState(
    new Date().toISOString().slice(0, 16)
  );
  const [purpose, setPurpose] = React.useState("");
  const [location, setLocation] = React.useState("Google Meet");
  const [attendees, setAttendees] = React.useState("Client Team, Lead Developer");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState<"SCHEDULED" | "COMPLETED" | "CANCELLED">("SCHEDULED");
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync preSelectedQuestionIds
  React.useEffect(() => {
    if (preSelectedQuestionIds.length > 0) {
      setSelectedQuestionIds(preSelectedQuestionIds);
      setIsNewModalOpen(true);
    }
  }, [preSelectedQuestionIds]);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          meetingDate: new Date(meetingDate).toISOString(),
          purpose: purpose.trim() || null,
          location: location.trim() || "Google Meet",
          attendees: attendees.trim() || null,
          notes: notes.trim(),
          status,
          linkedQuestionIds: selectedQuestionIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onMeetingsChange([data.meeting, ...meetings]);
        toast.success("Meeting scheduled & logged!");
        setIsNewModalOpen(false);
        resetForm();
      } else {
        toast.error("Failed to create meeting");
      }
    } catch (err) {
      toast.error("Failed to create meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setPurpose("");
    setLocation("Google Meet");
    setAttendees("Client Team, Lead Developer");
    setNotes("");
    setStatus("SCHEDULED");
    setSelectedQuestionIds([]);
  };

  const handleStatusToggle = async (meetingId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "SCHEDULED" ? "COMPLETED" : "SCHEDULED";
    try {
      const res = await fetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        onMeetingsChange(
          meetings.map((m) => (m.id === meetingId ? { ...m, status: nextStatus } : m))
        );
        toast.success(`Meeting status marked as ${nextStatus}`);
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onMeetingsChange(meetings.filter((m) => m.id !== meetingId));
        toast.success("Meeting deleted");
      }
    } catch (err) {
      toast.error("Failed to delete meeting");
    }
  };

  const handleUnlinkQuestionFromMeeting = async (meetingId: string, questionId: string) => {
    const currentMeeting = meetings.find((m) => m.id === meetingId);
    if (!currentMeeting) return;

    const updatedQuestionIds = (currentMeeting.meetingQuestions || [])
      .filter((mq) => mq.question.id !== questionId)
      .map((mq) => mq.question.id);

    try {
      const res = await fetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedQuestionIds: updatedQuestionIds }),
      });

      if (res.ok) {
        const data = await res.json();
        onMeetingsChange(
          meetings.map((m) => (m.id === meetingId ? data.meeting : m))
        );
        toast.success("Question removed from meeting agenda");
      }
    } catch (err) {
      toast.error("Failed to remove question from meeting agenda");
    }
  };

  const handleUpdateNotes = async (meetingId: string, updatedNotes: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: updatedNotes }),
      });

      if (res.ok) {
        onMeetingsChange(
          meetings.map((m) => (m.id === meetingId ? { ...m, notes: updatedNotes } : m))
        );
        toast.success("Meeting minutes updated");
      }
    } catch (err) {
      toast.error("Failed to update notes");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#3B82F6]" strokeWidth={2.5} />
            <span>Meeting Management & Minutes</span>
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Track client meetings, log meeting notes, associate discussed questions, and preserve decision history.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            resetForm();
            setIsNewModalOpen(true);
          }}
          className="gap-2 shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          <span>Log / Schedule Meeting</span>
        </Button>
      </div>

      {/* Meetings List */}
      {meetings.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-lg border-2 border-dashed border-gray-300">
          <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-gray-800">No meetings logged yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Schedule an upcoming client call or log minutes from a past meeting discussion.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="mt-4 text-xs"
          >
            Log Meeting
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => {
            const isCompleted = meeting.status === "COMPLETED";
            return (
              <div
                key={meeting.id}
                className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden"
              >
                {/* Meeting Card Header */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white border-b-2 border-gray-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className={cn(
                          "text-xs font-extrabold uppercase px-2.5 py-0.5 rounded",
                          isCompleted
                            ? "bg-[#D1FAE5] text-[#065F46]"
                            : "bg-[#DBEAFE] text-[#1D4ED8]"
                        )}
                      >
                        {meeting.status}
                      </span>
                      <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatDateTime(meeting.meetingDate)}
                      </span>
                      {meeting.location && (
                        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {meeting.location}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-gray-900">
                      {meeting.title}
                    </h3>

                    {meeting.purpose && (
                      <p className="text-xs text-gray-600 font-medium mt-1">
                        <strong>Purpose:</strong> {meeting.purpose}
                      </p>
                    )}

                    {meeting.attendees && (
                      <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span>Attendees: {meeting.attendees}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start shrink-0">
                    <Button
                      variant={isCompleted ? "secondary" : "emerald"}
                      size="sm"
                      onClick={() => handleStatusToggle(meeting.id, meeting.status)}
                      className="text-xs"
                    >
                      {isCompleted ? "Mark as Scheduled" : "Mark Completed"}
                    </Button>

                    <button
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Delete meeting"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Linked Agenda Questions */}
                {meeting.meetingQuestions && meeting.meetingQuestions.length > 0 && (
                  <div className="p-4 bg-[#F3F4F6] border-b-2 border-gray-200">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Questions Discussed in this Meeting ({meeting.meetingQuestions.length})</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {meeting.meetingQuestions.map((mq) => (
                        <div
                          key={mq.question.id}
                          className="bg-white p-2.5 rounded-md border border-gray-200 flex items-start justify-between gap-2 group"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {mq.question.title}
                              </p>
                              <span className="text-[10px] text-gray-500 font-semibold uppercase">
                                {mq.question.category}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnlinkQuestionFromMeeting(meeting.id, mq.question.id)}
                            title="Remove question from this meeting"
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-0.5 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meeting Minutes & Notes */}
                <div className="p-5 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#10B981]" />
                      <span>Meeting Minutes / Key Decisions</span>
                    </h4>

                    {/* Gemini AI & Sarvam STT Actions for Minutes */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <VoiceMicButton
                        onTranscript={(transcript) => {
                          const currentNotes = meeting.notes || "";
                          const separator = currentNotes && !currentNotes.endsWith("\n") ? "\n" : "";
                          const updated = currentNotes + separator + transcript;
                          handleUpdateNotes(meeting.id, updated);
                        }}
                        variant="ghost"
                        size="sm"
                        label="Dictate Minutes"
                      />

                      <Button
                        variant="amber"
                        size="sm"
                        onClick={async () => {
                          if (!meeting.notes || !meeting.notes.trim()) {
                            toast.error("Please write or dictate some meeting notes first to extract tasks!");
                            return;
                          }
                          toast.info("Gemini AI is extracting follow-up action items...");
                          try {
                            const res = await fetch("/api/ai", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "extract_tasks",
                                text: meeting.notes,
                              }),
                            });
                            const data = await res.json();
                            if (res.ok && Array.isArray(data.result)) {
                              for (const t of data.result) {
                                await fetch(`/api/projects/${projectId}/tasks`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    title: t.title,
                                    description: t.description || null,
                                    priority: t.priority || "MEDIUM",
                                    meetingId: meeting.id,
                                  }),
                                });
                              }
                              toast.success(`Extracted and created ${data.result.length} follow-up tasks!`);
                            }
                          } catch (err) {
                            toast.error("Failed to extract tasks");
                          }
                        }}
                        className="text-[11px] h-7 px-2"
                      >
                        <CheckSquare className="w-3 h-3 text-amber-900" />
                        <span>AI Extract Tasks</span>
                      </Button>

                      <AIMagicButton
                        getText={() => meeting.notes || ""}
                        onResult={(improved) => handleUpdateNotes(meeting.id, improved)}
                        context={`Meeting: ${meeting.title}`}
                        variant="ghost"
                        size="sm"
                        allowedActions={["hinglish_to_english", "professional", "make_short", "grammar", "summarize", "english_to_simple"]}
                      />
                    </div>
                  </div>
                  <textarea
                    defaultValue={meeting.notes || ""}
                    placeholder="Write detailed notes in Hinglish or English (e.g., Client ne bola payment gateway Razorpay integrate karo)..."
                    onBlur={(e) => handleUpdateNotes(meeting.id, e.target.value)}
                    rows={3}
                    className="w-full p-3 rounded-md bg-[#F3F4F6] text-xs font-medium text-gray-900 placeholder:text-gray-400 border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6] resize-y transition"
                  />
                  <p className="text-[10px] text-gray-400 text-right">
                    Click outside box to auto-save notes
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / Log Meeting Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Schedule / Log Client Meeting"
        description="Record upcoming or past client discussions, link questions to ask, and write minutes."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateMeeting} className="space-y-4">
          <Input
            label="Meeting Title *"
            placeholder="e.g., Requirement Finalization & Payment Discussion"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Meeting Date & Time *
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full h-11 px-4 rounded-md bg-[#F3F4F6] text-gray-900 font-medium border-2 border-transparent outline-none focus:bg-white focus:border-[#3B82F6]"
                required
              />
            </div>

            <Input
              label="Location / Platform"
              placeholder="e.g., Google Meet, Zoom, Client Office"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <Input
            label="Attendees"
            placeholder="e.g., Lead Developer, Product Owner, Client Representative"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
          />

          <Textarea
            label="Meeting Purpose / Objectives"
            placeholder="e.g., Finalize user roles, clarify offline requirements, confirm payment gateway."
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
          />

          {/* Link Questions Checkbox List */}
          {questions.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Select Questions to Discuss ({selectedQuestionIds.length} selected)
              </label>
              <div className="max-h-40 overflow-y-auto p-3 rounded-md bg-[#F3F4F6] divide-y divide-gray-200 space-y-1">
                {questions.map((q) => {
                  const isChecked = selectedQuestionIds.includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className="flex items-start gap-2 py-1.5 cursor-pointer text-xs select-none hover:text-blue-600"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                          } else {
                            setSelectedQuestionIds(
                              selectedQuestionIds.filter((id) => id !== q.id)
                            );
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 mt-0.5"
                      />
                      <span className="font-semibold text-gray-900">{q.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <Textarea
            label="Initial Meeting Notes / Minutes"
            placeholder="Key takeaways, answers received, or discussion minutes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsNewModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Meeting"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
