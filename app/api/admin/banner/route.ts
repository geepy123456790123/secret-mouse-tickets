import { getTopBannerSettings, saveTopBannerSettings } from "@/lib/site-settings";

export async function GET() {
  const banner = await getTopBannerSettings();
  return Response.json({ ok: true, banner });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      enabled?: boolean;
      prefix?: string;
      highlight?: string;
      suffix?: string;
      textColor?: string;
      highlightColor?: string;
    };

    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      throw new Error("Banner visibility must be true or false.");
    }

    const banner = await saveTopBannerSettings(body);
    return Response.json({ ok: true, banner });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save banner settings." },
      { status: 400 }
    );
  }
}
