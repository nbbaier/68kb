<?php
/**
 * SQLite Database Initialization Script
 * 
 * This script creates the initial SQLite database structure for 68KB
 */

// Database file path
$db_file = __DIR__ . '/68kb.sqlite';

// Create/connect to database
try {
    $pdo = new PDO('sqlite:' . $db_file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connected to SQLite database successfully.\n";
    
    // Enable foreign keys
    $pdo->exec('PRAGMA foreign_keys = ON');
    
    // Create tables
    $tables = array();
    
    // Settings table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_settings (
        option_id INTEGER PRIMARY KEY AUTOINCREMENT,
        option_name TEXT NOT NULL DEFAULT '',
        option_value TEXT NOT NULL DEFAULT '',
        option_group TEXT NOT NULL DEFAULT 'site',
        auto_load TEXT NOT NULL DEFAULT 'yes'
    )";
    
    // Users table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        custip TEXT NOT NULL DEFAULT '0',
        firstname TEXT NOT NULL DEFAULT '',
        lastname TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        username TEXT NOT NULL DEFAULT '',
        password TEXT NOT NULL DEFAULT '',
        joindate INTEGER NOT NULL DEFAULT 0,
        lastlogin INTEGER NOT NULL DEFAULT 0,
        cookie TEXT NOT NULL DEFAULT '',
        session TEXT NOT NULL DEFAULT '',
        level INTEGER NOT NULL DEFAULT 5
    )";
    
    // User groups table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_user_groups (
        group_id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_name TEXT NOT NULL DEFAULT '',
        group_description TEXT NOT NULL DEFAULT '',
        can_view_site TEXT NOT NULL DEFAULT 'y',
        can_access_admin TEXT NOT NULL DEFAULT 'n',
        can_manage_articles TEXT NOT NULL DEFAULT 'n',
        can_delete_articles TEXT NOT NULL DEFAULT 'n',
        can_manage_users TEXT NOT NULL DEFAULT 'n',
        can_manage_categories TEXT NOT NULL DEFAULT 'n',
        can_delete_categories TEXT NOT NULL DEFAULT 'n',
        can_manage_settings TEXT NOT NULL DEFAULT 'n',
        can_manage_utilities TEXT NOT NULL DEFAULT 'n',
        can_manage_themes TEXT NOT NULL DEFAULT 'n',
        can_manage_modules TEXT NOT NULL DEFAULT 'n',
        can_search TEXT NOT NULL DEFAULT 'y'
    )";
    
    // Categories table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_categories (
        cat_id INTEGER PRIMARY KEY AUTOINCREMENT,
        cat_parent INTEGER NOT NULL DEFAULT 0,
        cat_uri TEXT NOT NULL DEFAULT '0',
        cat_name TEXT NOT NULL DEFAULT '',
        cat_description TEXT NOT NULL DEFAULT '',
        cat_display TEXT NOT NULL DEFAULT 'N',
        cat_order INTEGER NOT NULL DEFAULT 0
    )";
    
    // Articles table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_articles (
        article_id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_uri TEXT NOT NULL DEFAULT '0',
        article_title TEXT NOT NULL DEFAULT '',
        article_keywords TEXT NOT NULL DEFAULT '',
        article_description TEXT NOT NULL DEFAULT '',
        article_short_desc TEXT NOT NULL DEFAULT '',
        article_date INTEGER NOT NULL DEFAULT 0,
        article_modified INTEGER NOT NULL DEFAULT 0,
        article_display TEXT NOT NULL DEFAULT 'N',
        article_hits INTEGER NOT NULL DEFAULT 0,
        article_author INTEGER NOT NULL DEFAULT 0,
        article_order INTEGER NOT NULL DEFAULT 0,
        article_rating INTEGER NOT NULL DEFAULT 0
    )";
    
    // Article to Category relationship table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_article2cat (
        article_id INTEGER NOT NULL DEFAULT 0,
        category_id INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (article_id, category_id)
    )";
    
    // Article tags table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_article_tags (
        tags_tag_id INTEGER NOT NULL DEFAULT 0,
        tags_article_id INTEGER NOT NULL DEFAULT 0
    )";
    
    // Tags table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL DEFAULT '0'
    )";
    
    // Attachments table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_attachments (
        attach_id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL DEFAULT 0,
        attach_name TEXT NOT NULL DEFAULT '',
        attach_type TEXT NOT NULL DEFAULT '',
        attach_size TEXT NOT NULL DEFAULT ''
    )";
    
    // Captcha table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_captcha (
        captcha_id INTEGER PRIMARY KEY AUTOINCREMENT,
        captcha_time INTEGER NOT NULL DEFAULT 0,
        ip_address TEXT NOT NULL DEFAULT '0',
        word TEXT NOT NULL DEFAULT '',
        a_size TEXT NOT NULL DEFAULT ''
    )";
    
    // Comments table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_comments (
        comment_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_article_ID INTEGER NOT NULL DEFAULT 0,
        comment_author TEXT NOT NULL DEFAULT '',
        comment_author_email TEXT NOT NULL DEFAULT '',
        comment_author_IP TEXT NOT NULL DEFAULT '',
        comment_date INTEGER NOT NULL DEFAULT 0,
        comment_content TEXT NOT NULL DEFAULT '',
        comment_approved TEXT NOT NULL DEFAULT '1'
    )";
    
    // Glossary table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_glossary (
        g_id INTEGER PRIMARY KEY AUTOINCREMENT,
        g_term TEXT NOT NULL DEFAULT '',
        g_definition TEXT NOT NULL DEFAULT ''
    )";
    
    // Modules table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_modules (
        module_id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_name TEXT NOT NULL DEFAULT '',
        module_display_name TEXT NOT NULL DEFAULT '',
        module_description TEXT NOT NULL DEFAULT '',
        module_directory TEXT NOT NULL DEFAULT '',
        module_version TEXT NOT NULL DEFAULT '',
        module_active TEXT NOT NULL DEFAULT 'yes',
        module_order INTEGER NOT NULL DEFAULT 100
    )";
    
    // Search log table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_searchlog (
        searchlog_id INTEGER PRIMARY KEY AUTOINCREMENT,
        searchlog_term TEXT NOT NULL DEFAULT '',
        searchlog_date INTEGER NOT NULL DEFAULT 0,
        searchlog_user_id INTEGER NOT NULL DEFAULT 0,
        searchlog_ip TEXT NOT NULL DEFAULT ''
    )";
    
    // Sessions table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_sessions (
        session_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL DEFAULT '0',
        user_agent TEXT NOT NULL DEFAULT '',
        last_activity INTEGER NOT NULL DEFAULT 0
    )";
    
    // Search table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_search (
        search_id TEXT NOT NULL DEFAULT '0',
        search_date INTEGER NOT NULL DEFAULT 0,
        search_keywords TEXT NOT NULL DEFAULT '',
        search_user_id INTEGER NOT NULL DEFAULT 0,
        search_ip TEXT NOT NULL DEFAULT '',
        search_total INTEGER NOT NULL DEFAULT 0
    )";
    
    // Failed logins table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_failed_logins (
        failed_id INTEGER PRIMARY KEY AUTOINCREMENT,
        failed_username TEXT NOT NULL DEFAULT '',
        failed_ip TEXT NOT NULL DEFAULT '',
        failed_date INTEGER NOT NULL DEFAULT 0
    )";
    
    // User notes table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_user_notes (
        note_id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_user_id INTEGER NOT NULL DEFAULT 0,
        note_article_id INTEGER NOT NULL DEFAULT 0,
        note_content TEXT NOT NULL DEFAULT '',
        note_date INTEGER NOT NULL DEFAULT 0
    )";
    
    // Article fields table
    $tables[] = "CREATE TABLE IF NOT EXISTS kb_article_fields (
        field_id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_name TEXT NOT NULL DEFAULT '',
        field_type TEXT NOT NULL DEFAULT '',
        field_label TEXT NOT NULL DEFAULT '',
        field_order INTEGER NOT NULL DEFAULT 0
    )";
    
    // Create indexes
    $indexes = array();
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_articles_uri ON kb_articles(article_uri)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_articles_title ON kb_articles(article_title)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_categories_uri ON kb_categories(cat_uri)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_categories_name ON kb_categories(cat_name)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_article2cat_article ON kb_article2cat(article_id)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_article2cat_category ON kb_article2cat(category_id)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_comments_article ON kb_comments(comment_article_ID)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_settings_name ON kb_settings(option_name)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_users_email ON kb_users(email)";
    $indexes[] = "CREATE INDEX IF NOT EXISTS idx_users_username ON kb_users(username)";
    
    // Execute table creation
    foreach ($tables as $sql) {
        try {
            $pdo->exec($sql);
            echo "Created table successfully.\n";
        } catch (PDOException $e) {
            echo "Error creating table: " . $e->getMessage() . "\n";
        }
    }
    
    // Execute index creation
    foreach ($indexes as $sql) {
        try {
            $pdo->exec($sql);
            echo "Created index successfully.\n";
        } catch (PDOException $e) {
            echo "Error creating index: " . $e->getMessage() . "\n";
        }
    }
    
    // Insert default settings
    $default_settings = array(
        array('site_name', 'Your Site', 'site', 'yes'),
        array('site_email', 'demo@demo.com', 'site', 'yes'),
        array('site_keywords', 'keywords, go, here', 'site', 'yes'),
        array('site_description', 'Site Description', 'site', 'yes'),
        array('site_max_search', '20', 'site', 'yes'),
        array('site_cache_time', '0', 'site', 'yes'),
        array('site_theme', 'default', 'site', 'yes'),
        array('site_admin_template', 'default', 'site', 'yes'),
        array('site_bad_words', '', 'site', 'no'),
        array('script_version', '3.0.0', 'script', 'yes'),
        array('script_build', '', 'script', 'yes'),
        array('script_db_version', '9', 'script', 'yes'),
        array('script_latest', '3.0.0', 'script', 'yes'),
        array('script_last_cron', '', 'script', 'yes')
    );
    
    $stmt = $pdo->prepare("INSERT INTO kb_settings (option_name, option_value, option_group, auto_load) VALUES (?, ?, ?, ?)");
    foreach ($default_settings as $setting) {
        try {
            $stmt->execute($setting);
            echo "Inserted setting: {$setting[0]}\n";
        } catch (PDOException $e) {
            echo "Error inserting setting {$setting[0]}: " . $e->getMessage() . "\n";
        }
    }
    
    // Insert default user groups
    $default_groups = array(
        array('Site Admins', 'Site Administrators', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y', 'y'),
        array('Registered', 'Registered Users', 'y', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'y'),
        array('Pending', 'Users Awaiting Email Confirmation', 'y', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n'),
        array('Banned', 'Banned Users', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n'),
        array('Guest', 'Site Visitors not logged in', 'y', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'y')
    );
    
    $stmt = $pdo->prepare("INSERT INTO kb_user_groups (group_name, group_description, can_view_site, can_access_admin, can_manage_articles, can_delete_articles, can_manage_users, can_manage_categories, can_delete_categories, can_manage_settings, can_manage_utilities, can_manage_themes, can_manage_modules, can_search) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    foreach ($default_groups as $group) {
        try {
            $stmt->execute($group);
            echo "Inserted user group: {$group[0]}\n";
        } catch (PDOException $e) {
            echo "Error inserting user group {$group[0]}: " . $e->getMessage() . "\n";
        }
    }
    
    echo "\nDatabase initialization completed successfully!\n";
    echo "Database file: $db_file\n";
    
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage() . "\n";
    exit(1);
}
