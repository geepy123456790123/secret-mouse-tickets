import { getTopBannerSettings, saveTopBannerSettings } from "@/lib/site-settings";

export async function GET() {
  const banner = await getTopBannerSettings();
  return Response.json({ ok: true, banner });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      prefix?: string;
      highlight?: string;
      suffix?: string;
      textColor?: string;
      highlightColor?: string;
    };

    const banner = await saveTopBannerSettings(body);
    return Response.json({ ok: true, banner });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save banner settings." },
      { status: 400 }
    );
  }
}
