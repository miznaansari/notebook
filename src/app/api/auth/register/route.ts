import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
    });

    // Create a starter project with sample notepad, questions and meeting prep
    const starterProject = await db.project.create({
      data: {
        name: "My Next.js Client Project",
        clientName: "Acme Corp / Sample Client",
        description: "Initial discovery and meeting management workspace for modern web application.",
        color: "#3B82F6",
        icon: "folder",
        userId: user.id,
        notes: {
          create: [
            {
              title: "Project Scope & Ideas",
              content: `# Project Overview & Ideas

Welcome to your project notepad! You can freely write project information, technical notes, requirements, and meeting takeaways here.

### Key Milestones:
- **Phase 1**: Requirement gathering & client Q&A finalization.
- **Phase 2**: Database schema & architecture design.
- **Phase 3**: UI Prototype & Client Walkthrough.
- **Phase 4**: Testing, deployment & handoff.

### Tech Stack Choices:
- **Frontend**: Next.js (App Router), Tailwind CSS
- **Database**: MySQL with Prisma ORM
- **Authentication**: JWT Token (30 Days Validity)
`,
              isPinned: true,
              tags: "Overview,Architecture,Planning",
            },
            {
              title: "Meeting Scratchpad",
              content: `## Quick Scratchpad
- Note down rapid thoughts during the client call
- Copy paste important links and snippets
- Keep track of unanswered queries
`,
              isPinned: false,
              tags: "Scratchpad,QuickNotes",
            },
          ],
        },
        questions: {
          create: [
            {
              title: "Website mein kaun-kaun se user roles hone chahiye?",
              category: "User Management",
              status: "ANSWERED",
              priority: "HIGH",
              forNextMeeting: false,
              details: "Need clarity on permissions for Admin, Manager and Staff.",
              answers: {
                create: [
                  {
                    content: "Admin, Manager aur Staff. Admin ke paas full permissions hongi aur Staff limited actions kar sakega.",
                    author: "Client",
                  },
                ],
              },
            },
            {
              title: "Kaunsa payment gateway use karna hai?",
              category: "Payment",
              status: "ANSWERED",
              priority: "URGENT",
              forNextMeeting: false,
              details: "Payment processing gateway integration.",
              answers: {
                create: [
                  {
                    content: "Razorpay integration with support for UPI and NetBanking.",
                    author: "Client",
                  },
                ],
              },
            },
            {
              title: "Kya application offline mode mein bhi work karni chahiye?",
              category: "Technical",
              status: "NEED_FOLLOWUP",
              priority: "HIGH",
              forNextMeeting: true,
              details: "Need follow-up on whether basic drafting should work without internet.",
            },
            {
              title: "Reports PDF mein chahiye ya Excel (.xlsx) mein?",
              category: "Reports",
              status: "PENDING",
              priority: "MEDIUM",
              forNextMeeting: true,
              details: "Check report export format preferences.",
            },
          ],
        },
        meetings: {
          create: [
            {
              title: "Initial Requirement Discussion",
              meetingDate: new Date(),
              purpose: "Project scope definition and basic features walkthrough.",
              location: "Google Meet",
              attendees: "Client Team, Lead Developer",
              notes: "Client explained business goals. Finalized user roles and payment gateway. Need follow-up on offline support and report exports.",
              status: "COMPLETED",
            },
          ],
        },
        tasks: {
          create: [
            {
              title: "Confirm Razorpay merchant account and sandbox credentials",
              priority: "HIGH",
              status: "PENDING",
              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            },
            {
              title: "Prepare report format mockup (PDF vs Excel)",
              priority: "MEDIUM",
              status: "PENDING",
              dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email },
        starterProjectId: starterProject.id,
        message: "Account created successfully.",
      },
      { status: 201 }
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 Days
    });

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to register account." },
      { status: 500 }
    );
  }
}
