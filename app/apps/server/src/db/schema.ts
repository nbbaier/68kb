import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------
export const settings = sqliteTable('settings', {
  optionId: integer('option_id').primaryKey({ autoIncrement: true }),
  optionName: text('option_name').notNull().default(''),
  optionValue: text('option_value').notNull().default(''),
  optionGroup: text('option_group').notNull().default('site'),
  autoLoad: text('auto_load', { enum: ['no', 'yes'] }).notNull().default('yes'),
})

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert

// ---------------------------------------------------------------------------
// user_groups
// ---------------------------------------------------------------------------
export const userGroups = sqliteTable('user_groups', {
  groupId: integer('group_id').primaryKey({ autoIncrement: true }),
  groupName: text('group_name').notNull().default(''),
  groupDescription: text('group_description').notNull().default(''),
  canViewSite: text('can_view_site', { enum: ['y', 'n'] }).notNull().default('y'),
  canAccessAdmin: text('can_access_admin', { enum: ['y', 'n'] }).notNull().default('n'),
  canManageArticles: text('can_manage_articles', { enum: ['y', 'n'] }).notNull().default('n'),
  canDeleteArticles: text('can_delete_articles', { enum: ['y', 'n'] }).notNull().default('n'),
  canManageUsers: text('can_manage_users', { enum: ['y', 'n'] }).notNull().default('n'),
  canManageCategories: text('can_manage_categories', { enum: ['y', 'n'] }).notNull().default('n'),
  canDeleteCategories: text('can_delete_categories', { enum: ['y', 'n'] }).notNull().default('n'),
  canManageSettings: text('can_manage_settings', { enum: ['y', 'n'] }).notNull().default('n'),
  canManageUtilities: text('can_manage_utilities', { enum: ['y', 'n'] }).notNull().default('n'),
  canManageThemes: text('can_manage_themes', { enum: ['y', 'n'] }).notNull().default('n'),
  canManageModules: text('can_manage_modules', { enum: ['y', 'n'] }).notNull().default('n'),
  canSearch: text('can_search', { enum: ['y', 'n'] }).notNull().default('y'),
})

export type UserGroup = typeof userGroups.$inferSelect
export type NewUserGroup = typeof userGroups.$inferInsert

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = sqliteTable('users', {
  userId: integer('user_id').primaryKey({ autoIncrement: true }),
  userIp: text('user_ip').notNull().default(''),
  userEmail: text('user_email').notNull().default(''),
  userUsername: text('user_username').notNull().default(''),
  userPassword: text('user_password').notNull().default(''),
  userGroup: integer('user_group').notNull().default(0).references(() => userGroups.groupId),
  userJoinDate: integer('user_join_date').notNull().default(0),
  userLastLogin: integer('user_last_login').notNull().default(0),
  lastActivity: integer('last_activity').notNull().default(0),
  userCookie: text('user_cookie').notNull().default(''),
  userSession: text('user_session').notNull().default(''),
  userApiKey: text('user_api_key').notNull().default(''),
  userVerify: text('user_verify').notNull().default(''),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ---------------------------------------------------------------------------
// user_notes
// ---------------------------------------------------------------------------
export const userNotes = sqliteTable('user_notes', {
  noteId: integer('note_id').primaryKey({ autoIncrement: true }),
  noteUserId: integer('note_user_id').notNull().default(0).references(() => users.userId),
  noteAddedBy: integer('note_added_by').notNull().default(0),
  noteDate: integer('note_date').notNull().default(0),
  note: text('note').notNull().default(''),
  noteImportant: text('note_important', { enum: ['y', 'n'] }).notNull().default('n'),
  noteShowUser: text('note_show_user', { enum: ['y', 'n'] }).notNull().default('n'),
})

export type UserNote = typeof userNotes.$inferSelect
export type NewUserNote = typeof userNotes.$inferInsert

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------
export const categories = sqliteTable('categories', {
  catId: integer('cat_id').primaryKey({ autoIncrement: true }),
  catParent: integer('cat_parent').notNull().default(0),
  catUri: text('cat_uri').notNull().default(''),
  catName: text('cat_name').notNull().default(''),
  catKeywords: text('cat_keywords').notNull().default(''),
  catImage: text('cat_image').notNull().default(''),
  catDescription: text('cat_description').notNull().default(''),
  catAllowads: text('cat_allowads', { enum: ['no', 'yes'] }).notNull().default('yes'),
  catDisplay: text('cat_display', { enum: ['no', 'yes'] }).notNull().default('yes'),
  catOrder: integer('cat_order').notNull().default(0),
  catPromo: text('cat_promo').notNull().default(''),
  catViews: integer('cat_views').notNull().default(0),
})

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

// ---------------------------------------------------------------------------
// articles
// ---------------------------------------------------------------------------
export const articles = sqliteTable('articles', {
  articleId: integer('article_id').primaryKey({ autoIncrement: true }),
  articleUri: text('article_uri').notNull().default(''),
  articleTitle: text('article_title').notNull().default(''),
  articleKeywords: text('article_keywords').notNull().default(''),
  articleDescription: text('article_description').notNull().default(''),
  articleShortDesc: text('article_short_desc').notNull().default(''),
  articleDate: integer('article_date').notNull().default(0),
  articleModified: integer('article_modified').notNull().default(0),
  articleDisplay: text('article_display', { enum: ['y', 'n'] }).notNull().default('n'),
  articleHits: integer('article_hits').notNull().default(0),
  articleAuthor: integer('article_author').notNull().default(0),
  articleOrder: integer('article_order').notNull().default(0),
  articleRating: integer('article_rating').notNull().default(0),
})

export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert

// ---------------------------------------------------------------------------
// article2cat (junction: articles ↔ categories)
// ---------------------------------------------------------------------------
export const article2cat = sqliteTable(
  'article2cat',
  {
    articleIdRel: integer('article_id_rel').notNull().references(() => articles.articleId),
    categoryIdRel: integer('category_id_rel').notNull().references(() => categories.catId),
  },
  (t) => [primaryKey({ columns: [t.articleIdRel, t.categoryIdRel] })],
)

export type Article2Cat = typeof article2cat.$inferSelect
export type NewArticle2Cat = typeof article2cat.$inferInsert

// ---------------------------------------------------------------------------
// tags
// ---------------------------------------------------------------------------
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tag: text('tag').notNull().default(''),
})

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

// ---------------------------------------------------------------------------
// article_tags (junction: articles ↔ tags)
// ---------------------------------------------------------------------------
export const articleTags = sqliteTable(
  'article_tags',
  {
    tagsTagId: integer('tags_tag_id').notNull().references(() => tags.id),
    tagsArticleId: integer('tags_article_id').notNull().references(() => articles.articleId),
  },
  (t) => [primaryKey({ columns: [t.tagsTagId, t.tagsArticleId] })],
)

export type ArticleTag = typeof articleTags.$inferSelect
export type NewArticleTag = typeof articleTags.$inferInsert

// ---------------------------------------------------------------------------
// attachments
// ---------------------------------------------------------------------------
export const attachments = sqliteTable('attachments', {
  attachId: integer('attach_id').primaryKey({ autoIncrement: true }),
  articleId: integer('article_id').notNull().default(0).references(() => articles.articleId),
  attachFile: text('attach_file').notNull().default(''),
  attachTitle: text('attach_title').notNull().default(''),
  attachType: text('attach_type').notNull().default(''),
  attachSize: text('attach_size').notNull().default(''),
})

export type Attachment = typeof attachments.$inferSelect
export type NewAttachment = typeof attachments.$inferInsert

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------
export const comments = sqliteTable('comments', {
  commentId: integer('comment_ID').primaryKey({ autoIncrement: true }),
  commentArticleId: integer('comment_article_ID').notNull().default(0).references(() => articles.articleId),
  commentAuthor: text('comment_author').notNull().default(''),
  commentAuthorEmail: text('comment_author_email').notNull().default(''),
  commentAuthorIp: text('comment_author_IP').notNull().default(''),
  commentDate: integer('comment_date').notNull().default(0),
  commentContent: text('comment_content').notNull().default(''),
  commentApproved: text('comment_approved', { enum: ['0', '1', 'spam'] }).notNull().default('1'),
})

export type Comment = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert

// ---------------------------------------------------------------------------
// glossary
// ---------------------------------------------------------------------------
export const glossary = sqliteTable('glossary', {
  gId: integer('g_id').primaryKey({ autoIncrement: true }),
  gTerm: text('g_term').notNull().default(''),
  gDefinition: text('g_definition').notNull().default(''),
})

export type Glossary = typeof glossary.$inferSelect
export type NewGlossary = typeof glossary.$inferInsert

// ---------------------------------------------------------------------------
// search (search cache)
// ---------------------------------------------------------------------------
export const searchCache = sqliteTable('search', {
  searchId: text('search_id').primaryKey(),
  searchDate: integer('search_date').notNull().default(0),
  searchKeywords: text('search_keywords').notNull().default(''),
  searchUserId: integer('search_user_id').notNull().default(0),
  searchIp: text('search_ip').notNull().default(''),
  searchTotal: integer('search_total').notNull().default(0),
})

export type SearchCache = typeof searchCache.$inferSelect
export type NewSearchCache = typeof searchCache.$inferInsert

// ---------------------------------------------------------------------------
// searchlog
// ---------------------------------------------------------------------------
export const searchLog = sqliteTable('searchlog', {
  searchlogId: integer('searchlog_id').primaryKey({ autoIncrement: true }),
  searchlogTerm: text('searchlog_term').notNull().default(''),
  searchlogDate: integer('searchlog_date').notNull().default(0),
  searchlogUserId: integer('searchlog_user_id').notNull().default(0),
  searchlogIp: text('searchlog_ip').notNull().default(''),
})

export type SearchLog = typeof searchLog.$inferSelect
export type NewSearchLog = typeof searchLog.$inferInsert

// ---------------------------------------------------------------------------
// failed_logins
// ---------------------------------------------------------------------------
export const failedLogins = sqliteTable('failed_logins', {
  failedId: integer('failed_id').primaryKey({ autoIncrement: true }),
  failedUsername: text('failed_username').notNull().default(''),
  failedIp: text('failed_ip').notNull().default(''),
  failedDate: integer('failed_date').notNull().default(0),
})

export type FailedLogin = typeof failedLogins.$inferSelect
export type NewFailedLogin = typeof failedLogins.$inferInsert

// ---------------------------------------------------------------------------
// modules
// ---------------------------------------------------------------------------
export const modules = sqliteTable('modules', {
  moduleId: integer('module_id').primaryKey({ autoIncrement: true }),
  moduleName: text('module_name').notNull().default(''),
  moduleDisplayName: text('module_display_name').notNull().default(''),
  moduleDescription: text('module_description').notNull().default(''),
  moduleDirectory: text('module_directory').notNull().default(''),
  moduleVersion: text('module_version').notNull().default(''),
  moduleActive: text('module_active', { enum: ['no', 'yes'] }).notNull().default('yes'),
  moduleOrder: integer('module_order').notNull().default(100),
})

export type Module = typeof modules.$inferSelect
export type NewModule = typeof modules.$inferInsert

// ---------------------------------------------------------------------------
// sessions (legacy CI sessions table — kept for schema parity)
// ---------------------------------------------------------------------------
export const sessions = sqliteTable('sessions', {
  sessionId: integer('session_id').primaryKey({ autoIncrement: true }),
  ipAddress: text('ip_address').notNull().default(''),
  userAgent: text('user_agent').notNull().default(''),
  lastActivity: integer('last_activity').notNull().default(0),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

// ---------------------------------------------------------------------------
// captcha
// ---------------------------------------------------------------------------
export const captcha = sqliteTable('captcha', {
  captchaId: integer('captcha_id').primaryKey({ autoIncrement: true }),
  captchaTime: integer('captcha_time').notNull().default(0),
  ipAddress: text('ip_address').notNull().default(''),
  word: text('word').notNull().default(''),
  aSize: text('a_size').notNull().default(''),
})

export type Captcha = typeof captcha.$inferSelect
export type NewCaptcha = typeof captcha.$inferInsert

// ---------------------------------------------------------------------------
// article_fields
// ---------------------------------------------------------------------------
export const articleFields = sqliteTable('article_fields', {
  articleFieldId: integer('article_field_id').primaryKey({ autoIncrement: true }),
})

export type ArticleField = typeof articleFields.$inferSelect
export type NewArticleField = typeof articleFields.$inferInsert

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const userGroupsRelations = relations(userGroups, ({ many }) => ({
  users: many(users),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  group: one(userGroups, {
    fields: [users.userGroup],
    references: [userGroups.groupId],
  }),
  notes: many(userNotes),
}))

export const userNotesRelations = relations(userNotes, ({ one }) => ({
  user: one(users, {
    fields: [userNotes.noteUserId],
    references: [users.userId],
  }),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  articleLinks: many(article2cat),
}))

export const articlesRelations = relations(articles, ({ many }) => ({
  categoryLinks: many(article2cat),
  tagLinks: many(articleTags),
  attachments: many(attachments),
  comments: many(comments),
}))

export const article2catRelations = relations(article2cat, ({ one }) => ({
  article: one(articles, {
    fields: [article2cat.articleIdRel],
    references: [articles.articleId],
  }),
  category: one(categories, {
    fields: [article2cat.categoryIdRel],
    references: [categories.catId],
  }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  articleLinks: many(articleTags),
}))

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  tag: one(tags, {
    fields: [articleTags.tagsTagId],
    references: [tags.id],
  }),
  article: one(articles, {
    fields: [articleTags.tagsArticleId],
    references: [articles.articleId],
  }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  article: one(articles, {
    fields: [attachments.articleId],
    references: [articles.articleId],
  }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  article: one(articles, {
    fields: [comments.commentArticleId],
    references: [articles.articleId],
  }),
}))
