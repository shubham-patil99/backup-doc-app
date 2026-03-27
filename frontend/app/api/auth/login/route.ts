import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/apiClient";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // Forward to real backend (already returns parsed JSON)
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    // No need for res.ok check here, apiFetch already throws on error

    // Set JWT and role in cookies
    const response = NextResponse.json(data);
    response.cookies.set("token", data.token, { 
      path: "/",      
       httpOnly: true,
      sameSite: "lax", // or "none" if using cross-domain + HTTPS
      secure: false,   // true if HTTPS
      maxAge: 60 * 60 * 24, // 1 day 
      });

    response.cookies.set("role", String(data.user.role), {
       path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24,
      });

    return response;
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
