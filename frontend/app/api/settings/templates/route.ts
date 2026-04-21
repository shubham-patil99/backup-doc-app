export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const response = await fetch("http://localhost:5431/api/settings/templates", {
      method: "GET",
      headers: {
        "Cookie": request.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      return Response.json({ error: "Failed to fetch templates" }, { status: response.status });
    }

    const templates = await response.json();
    return Response.json(templates);
  } catch (err) {
    console.error("[API] GET /api/settings/templates error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const response = await fetch("http://localhost:5431/api/settings/templates", {
      method: "POST",
      body: formData,
      headers: {
        "Cookie": request.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return Response.json(error, { status: response.status });
    }

    const result = await response.json();
    return Response.json(result);
  } catch (err) {
    console.error("[API] POST /api/settings/templates error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
