<?php
/**
 * Contacts API Endpoints
 */

require_once __DIR__ . '/../includes/functions.php';

handleCORS();

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

$user = authenticateToken();

switch ($action) {
    case 'list':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleListContacts($db, $user);
        break;

    case 'add':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleAddContact($db, $user);
        break;

    case 'delete':
        if ($method !== 'DELETE' && $method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleDeleteContact($db, $user);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}

function handleListContacts($db, $user) {
    $contacts = $db->fetchAll("
        SELECT c.*, u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen, u.public_key
        FROM contacts c
        JOIN users u ON c.contact_id = u.id
        WHERE c.user_id = ?
        ORDER BY u.display_name ASC
    ", [$user['id']]);

    $result = array_map(function($c) {
        return [
            'id' => $c['id'],
            'username' => $c['username'],
            'displayName' => $c['nickname'] ?: $c['display_name'],
            'avatarColor' => $c['avatar_color'],
            'status' => $c['status'],
            'lastSeen' => $c['last_seen'],
            'publicKey' => json_decode($c['public_key'], true),
            'isBlocked' => (bool) $c['is_blocked'],
            'addedAt' => $c['created_at']
        ];
    }, $contacts);

    jsonResponse($result);
}

function handleAddContact($db, $user) {
    $data = getJsonInput();
    $username = sanitize($data['username'] ?? '');

    if (empty($username)) {
        jsonResponse(['error' => 'Username required'], 400);
    }

    // Find user
    $contactUser = $db->fetch("SELECT * FROM users WHERE username = ?", [strtolower($username)]);
    if (!$contactUser) {
        jsonResponse(['error' => 'User not found'], 404);
    }

    if ($contactUser['id'] == $user['id']) {
        jsonResponse(['error' => 'Cannot add yourself'], 400);
    }

    // Check if already exists
    $existing = $db->fetch(
        "SELECT id FROM contacts WHERE user_id = ? AND contact_id = ?",
        [$user['id'], $contactUser['id']]
    );
    if ($existing) {
        jsonResponse(['error' => 'Contact already exists'], 409);
    }

    // Add contact
    $db->insert(
        "INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)",
        [$user['id'], $contactUser['id']]
    );

    jsonResponse([
        'id' => $contactUser['id'],
        'username' => $contactUser['username'],
        'displayName' => $contactUser['display_name'],
        'avatarColor' => $contactUser['avatar_color'],
        'status' => $contactUser['status'],
        'lastSeen' => $contactUser['last_seen'],
        'publicKey' => json_decode($contactUser['public_key'], true),
        'isBlocked' => false,
        'addedAt' => date('Y-m-d H:i:s')
    ], 201);
}

function handleDeleteContact($db, $user) {
    $username = sanitize($_GET['username'] ?? '');

    if (empty($username)) {
        jsonResponse(['error' => 'Username required'], 400);
    }

    $contactUser = $db->fetch("SELECT id FROM users WHERE username = ?", [strtolower($username)]);
    if (!$contactUser) {
        jsonResponse(['error' => 'User not found'], 404);
    }

    $db->delete(
        "DELETE FROM contacts WHERE user_id = ? AND contact_id = ?",
        [$user['id'], $contactUser['id']]
    );

    jsonResponse(['success' => true]);
}
