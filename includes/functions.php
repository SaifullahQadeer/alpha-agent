<?php
/**
 * Helper Functions
 */

require_once __DIR__ . '/Database.php';

// Set JSON headers
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    echo json_encode($data);
    exit;
}

// Handle preflight requests
function handleCORS() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// Get JSON input
function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

// Generate UUID
function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Generate random color
function generateAvatarColor() {
    $colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#10b981'];
    return $colors[array_rand($colors)];
}

// Authenticate user by token
function authenticateToken() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';

    if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
        jsonResponse(['error' => 'Access token required'], 401);
    }

    $token = substr($authHeader, 7);
    $db = Database::getInstance();

    $session = $db->fetch("
        SELECT s.*, u.id as user_id, u.username, u.display_name, u.public_key, u.avatar_color
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > NOW()
    ", [$token]);

    if (!$session) {
        jsonResponse(['error' => 'Invalid or expired token'], 403);
    }

    return [
        'id' => $session['user_id'],
        'username' => $session['username'],
        'displayName' => $session['display_name'],
        'publicKey' => $session['public_key'],
        'avatarColor' => $session['avatar_color'],
        'token' => $token
    ];
}

// Sanitize input
function sanitize($input) {
    if (is_array($input)) {
        return array_map('sanitize', $input);
    }
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}
