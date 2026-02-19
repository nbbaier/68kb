<?php
/**
 * Test script to verify PDO SQLite database connection
 */

// Database path from the CodeIgniter config
$db_path = 'C:/Users/umair-pc/Desktop/MyProjects/68kb/upload/database/68kb.sqlite';

echo "Testing SQLite database connection...\n\n";

try {
    // Try to connect
    $pdo = new PDO('sqlite:' . $db_path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✓ Connected to SQLite database successfully!\n";
    
    // Test: List all tables
    echo "\nTables in database:\n";
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        echo "  - $table\n";
    }
    
    // Test: Check settings
    echo "\nSettings from kb_settings table:\n";
    $stmt = $pdo->query("SELECT option_name, option_value FROM kb_settings LIMIT 5");
    $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($settings as $setting) {
        echo "  - {$setting['option_name']}: {$setting['option_value']}\n";
    }
    
    // Test: Check user groups
    echo "\nUser groups from kb_user_groups table:\n";
    $stmt = $pdo->query("SELECT group_id, group_name FROM kb_user_groups");
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($groups as $group) {
        echo "  - {$group['group_id']}: {$group['group_name']}\n";
    }
    
    // Test: Insert a test record
    echo "\nTesting INSERT operation:\n";
    $test_title = 'Test Article ' . time();
    $stmt = $pdo->prepare("INSERT INTO kb_articles (article_uri, article_title, article_date, article_display) VALUES (?, ?, ?, ?)");
    $stmt->execute(['test-article', $test_title, time(), 'y']);
    $last_id = $pdo->lastInsertId();
    echo "  ✓ Inserted test article with ID: $last_id\n";
    
    // Test: Select the record back
    echo "\nTesting SELECT operation:\n";
    $stmt = $pdo->prepare("SELECT * FROM kb_articles WHERE article_id = ?");
    $stmt->execute([$last_id]);
    $article = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "  ✓ Retrieved article: {$article['article_title']}\n";
    
    // Test: Update the record
    echo "\nTesting UPDATE operation:\n";
    $stmt = $pdo->prepare("UPDATE kb_articles SET article_hits = ? WHERE article_id = ?");
    $stmt->execute([100, $last_id]);
    echo "  ✓ Updated article hits\n";
    
    // Test: Delete the record
    echo "\nTesting DELETE operation:\n";
    $stmt = $pdo->prepare("DELETE FROM kb_articles WHERE article_id = ?");
    $stmt->execute([$last_id]);
    echo "  ✓ Deleted test article\n";
    
    echo "\n" . str_repeat("=", 60) . "\n";
    echo "All tests passed successfully!\n";
    echo str_repeat("=", 60) . "\n";
    
} catch (PDOException $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}
