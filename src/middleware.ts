import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "notepad_ultra_secure_jwt_token_secret_key_2026_xyz";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const AUTH_COOKIE_NAME = "notepad_session_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, SECRET_KEY);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Protected workspace routes
  if (pathname.startsWith("/workspace")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect logged-in users from auth pages to workspace
  if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  // Protected API routes
  if (pathname.startsWith("/api/projects") || pathname.startsWith("/api/templates")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized access. Please log in." }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/workspace/:path*",
    "/login",
    "/register",
    "/api/projects/:path*",
    "/api/templates/:path*",
  ],
};
