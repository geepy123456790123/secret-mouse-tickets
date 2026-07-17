import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventPageUrl: text("event_page_url").notNull().unique(),
    infoBannerFirst: text("info_banner_first").notNull(),
    infoBannerSecond: text("info_banner_second").notNull(),
    eventStartDate: text("event_start_date").notNull(),
    eventEndDate: text("event_end_date").notNull(),
    validStartDate: text("valid_start_date").notNull(),
    validEndDate: text("valid_end_date").notNull(),
    destination: text("destination").notNull().default("disney_world"),
    hotelSpecialRateAvailable: integer("hotel_special_rate_available")
      .notNull()
      .default(0),
    hotelName: text("hotel_name"),
    hotelBookingUrl: text("hotel_booking_url"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("events_valid_window_idx").on(table.validStartDate, table.validEndDate),
    index("events_event_start_idx").on(table.eventStartDate),
    index("events_destination_idx").on(table.destination),
  ]
);

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  visitStartDate: text("visit_start_date").notNull(),
  visitEndDate: text("visit_end_date").notNull(),
  themeParkDays: integer("theme_park_days").notNull(),
  parkHopper: integer("park_hopper").notNull().default(0),
  guests10Plus: integer("guests_10_plus").notNull(),
  guests3To9: integer("guests_3_to_9").notNull(),
  floridaResident: integer("florida_resident").notNull().default(0),
  email: text("email").notNull(),
  status: text("status").notNull(),
  matchedEventId: integer("matched_event_id"),
  visitId: text("visit_id"),
  sessionId: text("session_id"),
  visitorId: text("visitor_id"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  landingPage: text("landing_page"),
  referrer: text("referrer"),
  referrerDomain: text("referrer_domain"),
  gclid: text("gclid"),
  fbclid: text("fbclid"),
  msclkid: text("msclkid"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const visits = sqliteTable(
  "visits",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id"),
    visitorId: text("visitor_id"),
    landingPage: text("landing_page"),
    referrer: text("referrer"),
    referrerDomain: text("referrer_domain"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    gclid: text("gclid"),
    fbclid: text("fbclid"),
    msclkid: text("msclkid"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("visits_created_at_idx").on(table.createdAt),
    index("visits_session_id_idx").on(table.sessionId),
    index("visits_visitor_id_idx").on(table.visitorId),
    index("visits_source_idx").on(table.utmSource, table.utmCampaign),
  ]
);

export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  discountCents: integer("discount_cents").notNull().default(0),
  active: integer("active").notNull().default(1),
  maxRedemptions: integer("max_redemptions"),
  redemptionCount: integer("redemption_count").notNull().default(0),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    eventId: integer("event_id").notNull(),
    status: text("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull().default(5700),
    currency: text("currency").notNull().default("USD"),
    confirmationNumber: text("confirmation_number"),
    couponCode: text("coupon_code"),
    squarePaymentLinkId: text("square_payment_link_id"),
    squareOrderId: text("square_order_id"),
    squarePaymentId: text("square_payment_id"),
    squarePaymentStatus: text("square_payment_status"),
    checkoutUrl: text("checkout_url"),
    checkoutReminderSentAt: text("checkout_reminder_sent_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    paidAt: text("paid_at"),
  },
  (table) => [
    index("orders_paid_at_idx").on(table.paidAt),
    index("orders_square_payment_link_idx").on(table.squarePaymentLinkId),
    index("orders_square_order_idx").on(table.squareOrderId),
    index("orders_square_payment_idx").on(table.squarePaymentId),
  ]
);

export const emailLogs = sqliteTable("email_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  providerMessageId: text("provider_message_id"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const scrapeRuns = sqliteTable("scrape_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull(),
  provider: text("provider"),
  query: text("query"),
  sourceUrl: text("source_url"),
  candidateCount: integer("candidate_count").notNull().default(0),
  parsedCount: integer("parsed_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  upsertedCount: integer("upserted_count").notNull().default(0),
  ignoredCount: integer("ignored_count").notNull().default(0),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const scrapeRunItems = sqliteTable(
  "scrape_run_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scrapeRunId: integer("scrape_run_id").notNull(),
    url: text("url").notNull(),
    status: text("status").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("scrape_run_items_run_idx").on(table.scrapeRunId),
    index("scrape_run_items_status_idx").on(table.status),
  ]
);

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
