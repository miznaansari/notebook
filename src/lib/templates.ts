export interface DefaultTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  questions: {
    title: string;
    category: string;
    details?: string;
    status: "PENDING" | "ASKED" | "ANSWERED" | "NEED_FOLLOWUP";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    forNextMeeting?: boolean;
    suggestedAnswer?: string;
  }[];
}

export const SYSTEM_TEMPLATES: DefaultTemplate[] = [
  {
    id: "standard-client-discovery",
    title: "Standard Client Requirement Discovery",
    category: "General / Web App",
    description: "Complete requirement gathering framework covering user roles, payments, reports, and architecture.",
    questions: [
      {
        title: "Website / App mein kaun-kaun se user roles hone chahiye?",
        category: "User Management",
        details: "E.g., Super Admin, Branch Manager, Staff, Customer, Auditor.",
        status: "PENDING",
        priority: "HIGH",
        forNextMeeting: true,
        suggestedAnswer: "Admin, Manager aur Staff roles required hain.",
      },
      {
        title: "Kya multiple admin users honge aur unke access level alag honge?",
        category: "User Management",
        details: "Role-based access control (RBAC) permissions matrix.",
        status: "PENDING",
        priority: "MEDIUM",
        forNextMeeting: true,
      },
      {
        title: "Kaunsa payment gateway integrate karna hai?",
        category: "Payment",
        details: "Razorpay, Stripe, Cashfree, ya Manual Bank Transfer / Cash on Delivery.",
        status: "PENDING",
        priority: "URGENT",
        forNextMeeting: true,
        suggestedAnswer: "Razorpay integration preferred.",
      },
      {
        title: "Online payment ke saath offline / cash payment receipt bhi generate karni hai?",
        category: "Payment",
        details: "Point of sale (POS) cash mode with receipt printing.",
        status: "PENDING",
        priority: "MEDIUM",
      },
      {
        title: "Refund process automated hoga ya admin manual approve karega?",
        category: "Payment",
        details: "Full vs partial refunds workflow.",
        status: "PENDING",
        priority: "LOW",
      },
      {
        title: "Kaun-kaun se analytical reports required hain?",
        category: "Reports",
        details: "Daily Sales, User Activity, Inventory/Transaction logs, Tax/GST summaries.",
        status: "PENDING",
        priority: "HIGH",
        forNextMeeting: true,
      },
      {
        title: "Reports PDF format mein chahiye, Excel (.xlsx) mein, ya dono?",
        category: "Reports",
        details: "Scheduled automated email dispatch for daily summaries.",
        status: "PENDING",
        priority: "MEDIUM",
      },
      {
        title: "Kya application offline mode mein bhi work karni chahiye?",
        category: "Technical",
        details: "Local caching and background sync when connection resumes.",
        status: "PENDING",
        priority: "HIGH",
        forNextMeeting: true,
      },
      {
        title: "Data backup aur export frequency kya honi chahiye?",
        category: "Technical",
        details: "Daily automated database backups with cloud storage.",
        status: "PENDING",
        priority: "LOW",
      },
    ],
  },
  {
    id: "next-meeting-agenda-pack",
    title: "Next Meeting Agenda Questions",
    category: "Meeting Prep",
    description: "Curated questions focused specifically on finalizing upcoming client meeting decisions.",
    questions: [
      {
        title: "Admin ke paas kya-kya specific permissions hongi?",
        category: "User Management",
        details: "User creation, audit log access, database backup, system settings.",
        status: "PENDING",
        priority: "HIGH",
        forNextMeeting: true,
      },
      {
        title: "Staff ke liye separate mobile UI view chahiye ya standard web portal?",
        category: "User Management",
        details: "Simplified field view for quick updates.",
        status: "PENDING",
        priority: "MEDIUM",
        forNextMeeting: true,
      },
      {
        title: "Payment gateway sandbox API keys aur credentials kab milenge?",
        category: "Payment",
        details: "Required to start test payment integration.",
        status: "PENDING",
        priority: "URGENT",
        forNextMeeting: true,
      },
      {
        title: "Reports daily/weekly/monthly email digest format mein chahiye?",
        category: "Reports",
        details: "Automated cron report dispatch to client email.",
        status: "PENDING",
        priority: "HIGH",
        forNextMeeting: true,
      },
      {
        title: "Domain aur Cloud Server details finalize karni hain.",
        category: "Technical",
        details: "AWS / Vercel / DigitalOcean hosting preference.",
        status: "PENDING",
        priority: "URGENT",
        forNextMeeting: true,
      },
    ],
  },
  {
    id: "saas-software-spec",
    title: "SaaS & Web Software Requirement Matrix",
    category: "SaaS Architecture",
    description: "Comprehensive blueprint for multi-tenant SaaS products, subscriptions, and integrations.",
    questions: [
      {
        title: "Tenant isolation level: Shared database ya Database-per-tenant?",
        category: "Architecture",
        details: "Security and compliance requirements.",
        status: "PENDING",
        priority: "HIGH",
      },
      {
        title: "Subscription billing tiers aur trial period duration kya hoga?",
        category: "Billing",
        details: "Monthly/Annual pricing, 14-day free trial, usage caps.",
        status: "PENDING",
        priority: "HIGH",
        forNextMeeting: true,
      },
      {
        title: "Notification channels: Email, SMS, WhatsApp Business API?",
        category: "Integrations",
        details: "Transactional alerts vs promotional messaging.",
        status: "PENDING",
        priority: "MEDIUM",
      },
      {
        title: "Audit logging and activity tracking required for security compliance?",
        category: "Security",
        details: "IP tracking, login history, data modification logs.",
        status: "PENDING",
        priority: "MEDIUM",
      },
    ],
  },
];
