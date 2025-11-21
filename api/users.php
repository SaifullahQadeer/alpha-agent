<?php
/**
 * Users API Endpoints
 */

require_once __DIR__ . '/../includes/functions.php';

handleCORS();

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'search';

$user = authenticateToken();

switch ($action) {
    case 'search':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleSearch($db, $user);
        break;

    case 'get':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleGetUser($db, $user);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}

function handleSearch($db, $user) {
    $query = sanitize($_GET['q'] ?? '');

    if (strlen($query) < 2) {
        jsonResponse([]);
    }

    $users = $db->fetchAll("
        SELECT id, username, display_name, avatar_color, status, last_seen
        FROM users
        WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?
        LIMIT 20
    ", ["%$query%", "%$query%", $user['id']]);

    $result = array_map(function($u) {
        return [
            'id' => $u['id'],
            'username' => $u['username'],
            'displayName' => $u['display_name'],
            'avatarColor' => $u['avatar_color'],
            'status' => $u['status'],
            'lastSeen' => $u['last_seen']
        ];
    }, $users);

    jsonResponse($result);
}

function handleGetUser($db, $user) {
    $username = sanitize($_GET['username'] ?? '');

    if (empty($username)) {
        jsonResponse(['error' => 'Username required'], 400);
    }

    $userData = $db->fetch("SELECT * FROM users WHERE username = ?", [strtolower($username)]);

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
        'lastSeen' => $userData['last_seen']
    ]);
}
