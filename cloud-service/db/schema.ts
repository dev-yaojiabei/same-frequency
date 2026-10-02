import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const nicknames = sqliteTable('nicknames', {
  key: text('key').primaryKey(), name: text('name').notNull(), createdAt: integer('created_at').notNull()
});
export const records = sqliteTable('pair_records', {
  nickname: text('nickname').notNull().references(()=>nicknames.key),
  id: text('id').notNull(), title: text('title').notNull(), kind: text('kind').notNull(),
  score: integer('score').notNull(), payload: text('payload').notNull(), createdAt: integer('created_at').notNull()
}, t=>[primaryKey({columns:[t.nickname,t.id]}),index('records_by_nickname_date').on(t.nickname,t.createdAt)]);
export const rates = sqliteTable('rate_windows', {
  key:text('key').primaryKey(), count:integer('count').notNull(), expiresAt:integer('expires_at').notNull()
},t=>[index('rate_expiry').on(t.expiresAt)]);
