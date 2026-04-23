export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { templateName: string } }
) {
  try {
    const templateName = params.templateName;

    const response = await fetch(
      `http://localhost:5431/api/settings/templates/${encodeURIComponent(templateName)}/download`,
      {
        method: "GET",
        headers: {
          "Cookie": request.headers.get("cookie") || "",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Download failed" }));
      return Response.json(error, { status: response.status });
    }

    const blob = await response.blob();
    return new Response(blob, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${templateName}"`,
      },
    });
  } catch (err) {
    console.error("[API] GET /api/settings/templates/:name/download error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
