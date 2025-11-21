<?php
/**
 * Authentication API Endpoints
 */

require_once __DIR__ . '/../includes/functions.php';

handleCORS();

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleRegister($db);
        break;

    case 'login':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleLogin($db);
        break;

    case 'logout':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleLogout($db);
        break;

    case 'me':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleGetMe($db);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}

function handleRegister($db) {
    $data = getJsonInput();

    $username = sanitize($data['username'] ?? '');
    $displayName = sanitize($data['displayName'] ?? '');
    $password = $data['password'] ?? '';
    $publicKey = $data['publicKey'] ?? '';

    if (empty($username) || empty($displayName) || empty($password) || empty($publicKey)) {
        jsonResponse(['error' => 'All fields are required'], 400);
    }

    // Check if username exists
    $existing = $db->fetch("SELECT id FROM users WHERE username = ?", [strtolower($username)]);
    if ($existing) {
        jsonResponse(['error' => 'Username already exists'], 409);
    }

    // Hash password
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $avatarColor = generateAvatarColor();

    // Insert user
    $userId = $db->insert(
        "INSERT INTO users (username, display_name, password_hash, public_key, avatar_color, status) VALUES (?, ?, ?, ?, ?, 'online')",
        [strtolower($username), $displayName, $passwordHash, json_encode($publicKey), $avatarColor]
    );

    // Create session
    $token = generateUUID();
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);

    $db->insert(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
        [$userId, $token, $expiresAt]
    );

    jsonResponse([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $userId,
            'username' => strtolower($username),
            'displayName' => $displayName,
            'publicKey' => $publicKey,
            'avatarColor' => $avatarColor
        ]
    ], 201);
}

function handleLogin($db) {
    $data = getJsonInput();

    $username = sanitize($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        jsonResponse(['error' => 'Username and password required'], 400);
    }

    // Find user
    $user = $db->fetch("SELECT * FROM users WHERE username = ?", [strtolower($username)]);
    if (!$user) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }

    // Verify password
    if (!password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }

    // Create session
    $token = generateUUID();
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);

    $db->insert(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
        [$user['id'], $token, $expiresAt]
    );

    // Update status
    $db->update("UPDATE users SET status = 'online', last_seen = NOW() WHERE id = ?", [$user['id']]);

    jsonResponse([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'displayName' => $user['display_name'],
            'publicKey' => json_decode($user['public_key'], true),
            'avatarColor' => $user['avatar_color']
        ]
    ]);
}

function handleLogout($db) {
    $user = authenticateToken();

    $db->delete("DELETE FROM sessions WHERE token = ?", [$user['token']]);
    $db->update("UPDATE users SET status = 'offline', last_seen = NOW() WHERE id = ?", [$user['id']]);

    jsonResponse(['success' => true]);
}

function handleGetMe($db) {
    $user = authenticateToken();

    $userData = $db->fetch("SELECT * FROM users WHERE id = ?", [$user['id']]);

    if (!$userData) {
        jsonResponse(['error' => 'User not found'], 404);
    }

    jsonResponse([
        'id' => $userData['id'],
        'username' => $userData['username'],
        'displayName' => $userData['display_name'],
        'publicKey' => json_decode($userData['public_key'], true),
        'avatarColor' => $userData['avatar_color'],
        'status' => $userData['status'],
        'lastSeen' => $userData['last_seen'],
        'createdAt' => $userData['created_at']
    ]);
}
