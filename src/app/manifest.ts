import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NotepadHub - AI Powered Notebook & Meeting Manager",
    short_name: "NotepadHub",
    description: "Personal project notebook, AI-powered meeting notes, and client Q&A workspace.",
    start_url: "/workspace",
    id: "/workspace",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#3B82F6",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    categories: ["productivity", "business", "utilities"],
    shortcuts: [
      {
        name: "Workspace",
        short_name: "Workspace",
        description: "Open your active project notebook",
        url: "/workspace",
        icons: [{ src: "/favicon.svg", sizes: "any" }],
      },
    ],
  };
}
