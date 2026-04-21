// @ts-nocheck
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const backendUrl = "http://localhost:5431/api/settings/logo/file";
    
    const response = await fetch(backendUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "Cookie": request.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch logo" }),
        { status: response.status }
      );
    }

    const blob = await response.blob();

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "max-age=86400", // Cache for 24 hours
      },
    });
  } catch (err) {
    console.error("[api/settings/logo/file] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
