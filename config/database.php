<?php
/**
 * Database Configuration
 * Update these settings with your Hostinger MySQL credentials
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');  // Change this
define('DB_USER', 'your_username');        // Change this
define('DB_PASS', 'your_password');        // Change this
define('DB_CHARSET', 'utf8mb4');

// Session configuration
define('SESSION_LIFETIME', 7 * 24 * 60 * 60); // 7 days in seconds

// Error reporting (set to 0 in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Timezone
date_default_timezone_set('UTC');
