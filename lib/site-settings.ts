import { ensureDatabase, getRawDb } from "@/db";

export type TopBannerSettings = {
  prefix: string;
  highlight: string;
  suffix: string;
  textColor: string;
  highlightColor: string;
};

const DEFAULT_TOP_BANNER_SETTINGS: TopBannerSettings = {
  prefix: "25% off our fee through August 31, use code",
  highlight: "SUMMERDEAL25",
  suffix: "at checkout",
  textColor: "#120f17",
  highlightColor: "#5d45b5",
};

const TOP_BANNER_SETTING_KEYS = {
  prefix: "top_banner_prefix",
  highlight: "top_banner_highlight",
  suffix: "top_banner_suffix",
  textColor: "top_banner_text_color",
  highlightColor: "top_banner_highlight_color",
} as const;

type SiteSettingRow = {
  key: string;
  value: string;
};

function normalizeColor(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

export async function getTopBannerSettings(): Promise<TopBannerSettings> {
  await ensureDatabase();

  const rows = await getRawDb()
    .prepare(
      `SELECT key, value FROM site_settings WHERE key IN (?, ?, ?, ?, ?)`
    )
    .bind(
      TOP_BANNER_SETTING_KEYS.prefix,
      TOP_BANNER_SETTING_KEYS.highlight,
      TOP_BANNER_SETTING_KEYS.suffix,
      TOP_BANNER_SETTING_KEYS.textColor,
      TOP_BANNER_SETTING_KEYS.highlightColor
    )
    .all<SiteSettingRow>();

  const values = new Map((rows.results ?? []).map((row) => [row.key, row.value]));

  return {
    prefix: values.get(TOP_BANNER_SETTING_KEYS.prefix) ?? DEFAULT_TOP_BANNER_SETTINGS.prefix,
    highlight:
      values.get(TOP_BANNER_SETTING_KEYS.highlight) ?? DEFAULT_TOP_BANNER_SETTINGS.highlight,
    suffix: values.get(TOP_BANNER_SETTING_KEYS.suffix) ?? DEFAULT_TOP_BANNER_SETTINGS.suffix,
    textColor: normalizeColor(
      values.get(TOP_BANNER_SETTING_KEYS.textColor),
      DEFAULT_TOP_BANNER_SETTINGS.textColor
    ),
    highlightColor: normalizeColor(
      values.get(TOP_BANNER_SETTING_KEYS.highlightColor),
      DEFAULT_TOP_BANNER_SETTINGS.highlightColor
    ),
  };
}

export async function saveTopBannerSettings(
  input: Partial<TopBannerSettings>
): Promise<TopBannerSettings> {
  await ensureDatabase();

  const next = {
    ...(await getTopBannerSettings()),
    ...input,
  };

  next.prefix = next.prefix.trim();
  next.highlight = next.highlight.trim();
  next.suffix = next.suffix.trim();
  next.textColor = normalizeColor(next.textColor, DEFAULT_TOP_BANNER_SETTINGS.textColor);
  next.highlightColor = normalizeColor(
    next.highlightColor,
    DEFAULT_TOP_BANNER_SETTINGS.highlightColor
  );

  await getRawDb().batch([
    getRawDb()
      .prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(TOP_BANNER_SETTING_KEYS.prefix, next.prefix),
    getRawDb()
      .prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(TOP_BANNER_SETTING_KEYS.highlight, next.highlight),
    getRawDb()
      .prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(TOP_BANNER_SETTING_KEYS.suffix, next.suffix),
    getRawDb()
      .prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(TOP_BANNER_SETTING_KEYS.textColor, next.textColor),
    getRawDb()
      .prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(TOP_BANNER_SETTING_KEYS.highlightColor, next.highlightColor),
  ]);

  return next;
}
