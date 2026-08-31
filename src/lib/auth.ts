import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "notepad_ultra_secure_jwt_token_secret_key_2026_xyz";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
export const AUTH_COOKIE_NAME = "notepad_session_token";

export interface AuthPayload {
  userId: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d") // 30-Day token validity as requested
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as AuthPayload;
  } catch (error) {
    return null;
  }
}

export async function getAuthUserFromCookies(): Promise<AuthPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (err) {
    return null;
  }
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<AuthPayload | null> {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value || req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (err) {
    return null;
  }
}
