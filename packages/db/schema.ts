import {
  pgTable, text, real, integer, timestamp,
  jsonb, serial, index, boolean,
} from 'drizzle-orm/pg-core';
// sql import available for raw PostGIS queries in migrations

// ─── 지진 카탈로그 (60K+ rows, ~15MB) ───

export const earthquakes = pgTable('earthquakes', {
  id:          text('id').primaryKey(),              // USGS event ID
  lat:         real('lat').notNull(),
  lng:         real('lng').notNull(),
  depth_km:    real('depth_km').notNull(),
  magnitude:   real('magnitude').notNull(),
  mag_type:    text('mag_type'),                     // Mw, Mb, ML
  time:        timestamp('time', { withTimezone: true }).notNull(),
  place:       text('place'),                        // "45km E of Sendai"
  place_ja:    text('place_ja'),                     // "宮城県沖"
  fault_type:  text('fault_type'),                   // crustal | interface | intraslab
  source:      text('source').notNull(),             // jma | usgs | gcmt
  tsunami:     boolean('tsunami').default(false),

  // Moment Tensor (M5+ events only)
  mt_strike:   real('mt_strike'),
  mt_dip:      real('mt_dip'),
  mt_rake:     real('mt_rake'),
  mt_strike2:  real('mt_strike2'),
  mt_dip2:     real('mt_dip2'),
  mt_rake2:    real('mt_rake2'),

  // Metadata — data freshness & source tracking
  updated_at:  timestamp('updated_at', { withTimezone: true }).defaultNow(),
  maxi:        text('maxi'),                     // JMA observed max intensity ("5+", "4")
  data_status: text('data_status').default('automatic'), // automatic | reviewed | deleted

  // PostGIS — stored as geography for distance calculations
  // NOTE: PostGIS geometry column managed via raw SQL migration
  // geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 })
}, (t) => [
  index('idx_earthquakes_time').on(t.time),
  index('idx_earthquakes_magnitude').on(t.magnitude),
  index('idx_earthquakes_source').on(t.source),
  // Composite: main events feed (WHERE magnitude >= ? ORDER BY time DESC)
  index('idx_earthquakes_mag_time').on(t.magnitude, t.time),
  // Composite: spatial bbox queries (spatialStats, USGS dedup)
  index('idx_earthquakes_time_lat_lng').on(t.time, t.lat, t.lng),
  index('idx_earthquakes_lat_lng').on(t.lat, t.lng),
  // GiST index on geom created via raw SQL migration
]);

// ─── AI 분석 (8K+ rows, ~200MB JSONB) ───

export const analyses = pgTable('analyses', {
  id:              serial('id').primaryKey(),
  event_id:        text('event_id').notNull()
                     .references(() => earthquakes.id),
  version:         integer('version').notNull().default(1),
  tier:            text('tier').notNull(),            // S | A | B
  model:           text('model').notNull(),           // claude-opus-4-6 etc
  prompt_version:  text('prompt_version').notNull(),  // v1.0.0

  // JSONB payloads
  context:         jsonb('context'),                  // EarthquakeContext input
  analysis:        jsonb('analysis').notNull(),       // EarthquakeAnalysis output

  // Search acceleration
  search_tags:     text('search_tags').array(),       // ['miyagi','m6','interface']
  search_region:   text('search_region'),             // 'tohoku'

  // Meta
  is_latest:       boolean('is_latest').notNull().default(true),
  trigger_reason:  text('trigger_reason').default('initial'), // initial | mag_revision | backfill
  created_at:      timestamp('created_at', { withTimezone: true })
                     .notNull().defaultNow(),
}, (t) => [
  index('idx_analyses_event').on(t.event_id),
  index('idx_analyses_latest').on(t.event_id, t.is_latest),
  // Partial index (WHERE is_latest = true) created via raw SQL migration (001_performance_indexes.sql)
  // — Drizzle schema doesn't support partial indexes; use idx_analyses_event_latest from migration.
  // GIN index on search_tags created via raw SQL migration
]);

// ─── 활성단층 (2K rows, ~1MB) ───

export const activeFaults = pgTable('active_faults', {
  id:                text('id').primaryKey(),
  name_ja:           text('name_ja'),
  name_en:           text('name_en'),
  fault_type:        text('fault_type'),              // reverse | normal | strike_slip
  recurrence_years:  integer('recurrence_years'),
  last_activity:     text('last_activity'),
  estimated_mw:      real('estimated_mw'),
  probability_30yr:  real('probability_30yr'),        // 0.0 ~ 1.0
  length_km:         real('length_km'),
  // PostGIS LineString managed via raw SQL migration
}, (t) => [
  index('idx_faults_name').on(t.name_ja),
]);

// ─── 정기 리포트 ───

export const reports = pgTable('reports', {
  id:          serial('id').primaryKey(),
  type:        text('type').notNull(),                // weekly | monthly
  period:      text('period').notNull(),              // 2026-W10 | 2026-03
  model:       text('model').notNull(),               // claude-opus-4-6
  content:     jsonb('content').notNull(),            // WeeklyBrief | MonthlyReport
  created_at:  timestamp('created_at', { withTimezone: true })
                 .notNull().defaultNow(),
}, (t) => [
  index('idx_reports_type_period').on(t.type, t.period),
]);
