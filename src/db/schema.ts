import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const segments = pgTable('segments', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  visible: integer('visible').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const revisionTabs = pgTable('revision_tabs', {
  id: serial('id').primaryKey(),
  revisionNumber: integer('revision_number').notNull().unique(),
  label: text('label').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  visible: integer('visible').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const models = pgTable('models', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  segmentSlug: text('segment_slug').notNull(),
  imageUrl: text('image_url').notNull().default(''),
  hidden: integer('hidden').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  laborPrice: doublePrecision('labor_price'),
});

export const parts = pgTable('parts', {
  code: text('code').primaryKey(),
  description: text('description').notNull(),
  unit: text('unit').notNull().default('UN'),
  defaultQty: doublePrecision('default_qty').notNull().default(1),
  price: doublePrecision('price').notNull().default(0),
  mode: text('mode').notNull().default('auto'),
  isOptional: integer('is_optional').notNull().default(0),
  microworkPrice: doublePrecision('microwork_price'),
  syncStatus: text('sync_status').notNull().default('Manual'),
  updatedAt: text('updated_at').notNull(),
});

export const partPrices = pgTable('part_prices', {
  id: serial('id').primaryKey(),
  partCode: text('part_code').notNull(),
  price: doublePrecision('price').notNull(),
  updatedAt: text('updated_at').notNull(),
  source: text('source').notNull().default('seed'),
});

export const revisionParts = pgTable('revision_parts', {
  id: serial('id').primaryKey(),
  modelId: integer('model_id')
    .notNull()
    .references(() => models.id, { onDelete: 'cascade' }),
  revisionNumber: integer('revision_number').notNull(),
  partCode: text('part_code')
    .notNull()
    .references(() => parts.code, { onDelete: 'cascade' }),
  quantity: doublePrecision('quantity').notNull().default(1),
});

export const faqs = pgTable('faqs', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const integrations = pgTable('integrations', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  configJson: text('config_json').notNull(),
  secretValue: text('secret_value').notNull().default(''),
  active: integer('active').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: text('created_at').notNull(),
});

export const modelsRelations = relations(models, ({ many }) => ({
  revisionParts: many(revisionParts),
}));

export const partsRelations = relations(parts, ({ many }) => ({
  revisionParts: many(revisionParts),
}));

export const revisionPartsRelations = relations(revisionParts, ({ one }) => ({
  model: one(models, {
    fields: [revisionParts.modelId],
    references: [models.id],
  }),
  part: one(parts, {
    fields: [revisionParts.partCode],
    references: [parts.code],
  }),
}));
