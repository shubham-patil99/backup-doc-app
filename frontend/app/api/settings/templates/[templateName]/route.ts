export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { templateName: string } }
) {
  try {
    const templateName = params.templateName;
    
    const response = await fetch(`http://localhost:5431/api/settings/templates/${encodeURIComponent(templateName)}`, {
      method: "DELETE",
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
    console.error("[API] DELETE /api/settings/templates error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
