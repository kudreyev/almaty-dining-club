import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
  doublePrecision,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  role: text('role').notNull().default('user'),
  phone: text('phone'),
  fullName: text('full_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const restaurants = pgTable('restaurants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  restaurantName: text('restaurant_name'),
  slug: text('slug').notNull().unique(),
  city: text('city'),
  district: text('district'),
  address: text('address'),
  phone: text('phone'),
  instagramUrl: text('instagram_url'),
  websiteUrl: text('website_url'),
  twoGisUrl: text('two_gis_url'),
  cuisine: text('cuisine'),
  cuisine2: text('cuisine_2'),
  cuisine3: text('cuisine_3'),
  description: text('description'),
  shortDescription: text('short_description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const restaurantHours = pgTable('restaurant_hours', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id').notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  isClosed: boolean('is_closed').notNull().default(false),
  openTime: time('open_time'),
  closeTime: time('close_time'),
  closeNextDay: boolean('close_next_day').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const restaurantLocations = pgTable('restaurant_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id').notNull(),
  address: text('address').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const restaurantPhotos = pgTable('restaurant_photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id').notNull(),
  publicUrl: text('public_url').notNull(),
  storagePath: text('storage_path').notNull(),
  thumbUrl: text('thumb_url').notNull(),
  fullUrl: text('full_url').notNull(),
  thumbPath: text('thumb_path').notNull(),
  fullPath: text('full_path').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id').notNull(),
  title: text('title').notNull(),
  offerTitle: text('offer_title'),
  offerType: text('offer_type'),
  offerTermsShort: text('offer_terms_short'),
  description: text('description'),
  estimatedValue: integer('estimated_value'),
  cooldownDays: integer('cooldown_days'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const redeemTokens = pgTable('redeem_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  offerId: uuid('offer_id').notNull(),
  userId: uuid('user_id'),
  token: text('token').notNull().unique(),
  status: text('status').notNull().default('active'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  extendDeadlineAt: timestamp('extend_deadline_at', { withTimezone: true }).notNull(),
  extendedOnce: boolean('extended_once').notNull().default(false),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const redemptions = pgTable('redemptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tokenId: uuid('token_id').notNull(),
  offerId: uuid('offer_id').notNull(),
  userId: uuid('user_id'),
  restaurantId: uuid('restaurant_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  status: text('status').notNull().default('active'),
  planName: text('plan_name').notNull().default('standard'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const activationLinks = pgTable('activation_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  phoneTarget: text('phone_target').notNull(),
  status: text('status').notNull().default('issued'),
  amount: integer('amount').notNull().default(1990),
  currency: text('currency').notNull().default('KZT'),
  activatedUserId: uuid('activated_user_id'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventName: text('event_name').notNull(),
  activationLinkId: uuid('activation_link_id'),
  token: text('token'),
  phoneTarget: text('phone_target'),
  userId: uuid('user_id'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const paymentRequests = pgTable('payment_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const staffUsers = pgTable('staff_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id').notNull(),
  pinCodeHash: text('pin_code_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const staffSessions = pgTable('staff_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id').notNull(),
  sessionTokenHash: text('session_token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
