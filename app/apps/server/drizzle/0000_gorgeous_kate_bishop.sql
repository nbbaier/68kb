CREATE TABLE `article2cat` (
	`article_id_rel` integer NOT NULL,
	`category_id_rel` integer NOT NULL,
	PRIMARY KEY(`article_id_rel`, `category_id_rel`),
	FOREIGN KEY (`article_id_rel`) REFERENCES `articles`(`article_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id_rel`) REFERENCES `categories`(`cat_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `article_fields` (
	`article_field_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL
);
--> statement-breakpoint
CREATE TABLE `article_tags` (
	`tags_tag_id` integer NOT NULL,
	`tags_article_id` integer NOT NULL,
	PRIMARY KEY(`tags_tag_id`, `tags_article_id`),
	FOREIGN KEY (`tags_tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tags_article_id`) REFERENCES `articles`(`article_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`article_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_uri` text DEFAULT '' NOT NULL,
	`article_title` text DEFAULT '' NOT NULL,
	`article_keywords` text DEFAULT '' NOT NULL,
	`article_description` text DEFAULT '' NOT NULL,
	`article_short_desc` text DEFAULT '' NOT NULL,
	`article_date` integer DEFAULT 0 NOT NULL,
	`article_modified` integer DEFAULT 0 NOT NULL,
	`article_display` text DEFAULT 'n' NOT NULL,
	`article_hits` integer DEFAULT 0 NOT NULL,
	`article_author` integer DEFAULT 0 NOT NULL,
	`article_order` integer DEFAULT 0 NOT NULL,
	`article_rating` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`attach_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer DEFAULT 0 NOT NULL,
	`attach_file` text DEFAULT '' NOT NULL,
	`attach_title` text DEFAULT '' NOT NULL,
	`attach_type` text DEFAULT '' NOT NULL,
	`attach_size` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`article_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `captcha` (
	`captcha_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`captcha_time` integer DEFAULT 0 NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`word` text DEFAULT '' NOT NULL,
	`a_size` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`cat_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cat_parent` integer DEFAULT 0 NOT NULL,
	`cat_uri` text DEFAULT '' NOT NULL,
	`cat_name` text DEFAULT '' NOT NULL,
	`cat_keywords` text DEFAULT '' NOT NULL,
	`cat_image` text DEFAULT '' NOT NULL,
	`cat_description` text DEFAULT '' NOT NULL,
	`cat_allowads` text DEFAULT 'yes' NOT NULL,
	`cat_display` text DEFAULT 'yes' NOT NULL,
	`cat_order` integer DEFAULT 0 NOT NULL,
	`cat_promo` text DEFAULT '' NOT NULL,
	`cat_views` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`comment_ID` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comment_article_ID` integer DEFAULT 0 NOT NULL,
	`comment_author` text DEFAULT '' NOT NULL,
	`comment_author_email` text DEFAULT '' NOT NULL,
	`comment_author_IP` text DEFAULT '' NOT NULL,
	`comment_date` integer DEFAULT 0 NOT NULL,
	`comment_content` text DEFAULT '' NOT NULL,
	`comment_approved` text DEFAULT '1' NOT NULL,
	FOREIGN KEY (`comment_article_ID`) REFERENCES `articles`(`article_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `failed_logins` (
	`failed_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`failed_username` text DEFAULT '' NOT NULL,
	`failed_ip` text DEFAULT '' NOT NULL,
	`failed_date` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `glossary` (
	`g_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`g_term` text DEFAULT '' NOT NULL,
	`g_definition` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`module_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_name` text DEFAULT '' NOT NULL,
	`module_display_name` text DEFAULT '' NOT NULL,
	`module_description` text DEFAULT '' NOT NULL,
	`module_directory` text DEFAULT '' NOT NULL,
	`module_version` text DEFAULT '' NOT NULL,
	`module_active` text DEFAULT 'yes' NOT NULL,
	`module_order` integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `search` (
	`search_id` text PRIMARY KEY NOT NULL,
	`search_date` integer DEFAULT 0 NOT NULL,
	`search_keywords` text DEFAULT '' NOT NULL,
	`search_user_id` integer DEFAULT 0 NOT NULL,
	`search_ip` text DEFAULT '' NOT NULL,
	`search_total` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `searchlog` (
	`searchlog_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`searchlog_term` text DEFAULT '' NOT NULL,
	`searchlog_date` integer DEFAULT 0 NOT NULL,
	`searchlog_user_id` integer DEFAULT 0 NOT NULL,
	`searchlog_ip` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`last_activity` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`option_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`option_name` text DEFAULT '' NOT NULL,
	`option_value` text DEFAULT '' NOT NULL,
	`option_group` text DEFAULT 'site' NOT NULL,
	`auto_load` text DEFAULT 'yes' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_groups` (
	`group_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_name` text DEFAULT '' NOT NULL,
	`group_description` text DEFAULT '' NOT NULL,
	`can_view_site` text DEFAULT 'y' NOT NULL,
	`can_access_admin` text DEFAULT 'n' NOT NULL,
	`can_manage_articles` text DEFAULT 'n' NOT NULL,
	`can_delete_articles` text DEFAULT 'n' NOT NULL,
	`can_manage_users` text DEFAULT 'n' NOT NULL,
	`can_manage_categories` text DEFAULT 'n' NOT NULL,
	`can_delete_categories` text DEFAULT 'n' NOT NULL,
	`can_manage_settings` text DEFAULT 'n' NOT NULL,
	`can_manage_utilities` text DEFAULT 'n' NOT NULL,
	`can_manage_themes` text DEFAULT 'n' NOT NULL,
	`can_manage_modules` text DEFAULT 'n' NOT NULL,
	`can_search` text DEFAULT 'y' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_notes` (
	`note_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_user_id` integer DEFAULT 0 NOT NULL,
	`note_added_by` integer DEFAULT 0 NOT NULL,
	`note_date` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`note_important` text DEFAULT 'n' NOT NULL,
	`note_show_user` text DEFAULT 'n' NOT NULL,
	FOREIGN KEY (`note_user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_ip` text DEFAULT '' NOT NULL,
	`user_email` text DEFAULT '' NOT NULL,
	`user_username` text DEFAULT '' NOT NULL,
	`user_password` text DEFAULT '' NOT NULL,
	`user_group` integer DEFAULT 0 NOT NULL,
	`user_join_date` integer DEFAULT 0 NOT NULL,
	`user_last_login` integer DEFAULT 0 NOT NULL,
	`last_activity` integer DEFAULT 0 NOT NULL,
	`user_cookie` text DEFAULT '' NOT NULL,
	`user_session` text DEFAULT '' NOT NULL,
	`user_api_key` text DEFAULT '' NOT NULL,
	`user_verify` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`user_group`) REFERENCES `user_groups`(`group_id`) ON UPDATE no action ON DELETE no action
);
