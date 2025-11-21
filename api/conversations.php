<?php
/**
 * Conversations API Endpoints
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
        handleListConversations($db, $user);
        break;

    case 'create':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleCreateConversation($db, $user);
        break;

    case 'get':
        if ($method !== 'GET') jsonResponse(['error' => 'Method not allowed'], 405);
        handleGetConversation($db, $user);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}

function handleListConversations($db, $user) {
    $conversations = $db->fetchAll("
        SELECT DISTINCT c.id, c.type, c.name, c.updated_at
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = ?
        ORDER BY c.updated_at DESC
    ", [$user['id']]);

    $result = [];
    foreach ($conversations as $conv) {
        // Get participants
        $participants = $db->fetchAll("
            SELECT u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
        ", [$conv['id']]);

        // Get last message
        $lastMessage = $db->fetch("
            SELECT m.*, u.display_name as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at DESC
            LIMIT 1
        ", [$conv['id']]);

        // Get unread count
        $unread = $db->fetch("
            SELECT COUNT(*) as count FROM messages m
            LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ?
            WHERE m.conversation_id = ? AND m.sender_id != ?
            AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
        ", [$user['id'], $conv['id'], $user['id']]);

        $result[] = [
            'id' => $conv['id'],
            'type' => $conv['type'],
            'name' => $conv['name'],
            'updatedAt' => $conv['updated_at'],
            'unreadCount' => $unread['count'] ?? 0,
            'participants' => array_map(function($p) {
                return [
                    'id' => $p['id'],
                    'username' => $p['username'],
                    'displayName' => $p['display_name'],
                    'avatarColor' => $p['avatar_color'],
                    'status' => $p['status'],
                    'lastSeen' => $p['last_seen']
                ];
            }, $participants),
            'lastMessage' => $lastMessage ? [
                'id' => $lastMessage['id'],
                'content' => $lastMessage['content'],
                'senderId' => $lastMessage['sender_id'],
                'senderName' => $lastMessage['sender_name'],
                'createdAt' => $lastMessage['created_at'],
                'status' => $lastMessage['status']
            ] : null
        ];
    }

    jsonResponse($result);
}

function handleCreateConversation($db, $user) {
    $data = getJsonInput();
    $participantUsername = sanitize($data['participantUsername'] ?? '');

    if (empty($participantUsername)) {
        jsonResponse(['error' => 'Participant username required'], 400);
    }

    // Find participant
    $participant = $db->fetch("SELECT * FROM users WHERE username = ?", [strtolower($participantUsername)]);
    if (!$participant) {
        jsonResponse(['error' => 'User not found'], 404);
    }

    // Check for existing conversation
    $existing = $db->fetch("
        SELECT c.id FROM conversations c
        JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
        JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        WHERE c.type = 'direct' AND cp1.user_id = ? AND cp2.user_id = ?
    ", [$user['id'], $participant['id']]);

    if ($existing) {
        jsonResponse([
            'id' => $existing['id'],
            'type' => 'direct',
            'isNew' => false
        ]);
    }

    // Create new conversation
    $convId = $db->insert("INSERT INTO conversations (type) VALUES ('direct')");

    // Add participants
    $db->insert(
        "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)",
        [$convId, $user['id']]
    );
    $db->insert(
        "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)",
        [$convId, $participant['id']]
    );

    jsonResponse([
        'id' => $convId,
        'type' => 'direct',
        'createdAt' => date('Y-m-d H:i:s'),
        'isNew' => true,
        'participant' => [
            'id' => $participant['id'],
            'username' => $participant['username'],
            'displayName' => $participant['display_name'],
            'avatarColor' => $participant['avatar_color'],
            'publicKey' => json_decode($participant['public_key'], true)
        ]
    ], 201);
}

function handleGetConversation($db, $user) {
    $convId = intval($_GET['id'] ?? 0);

    if (!$convId) {
        jsonResponse(['error' => 'Conversation ID required'], 400);
    }

    // Check if user is participant
    $isParticipant = $db->fetch(
        "SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
        [$convId, $user['id']]
    );

    if (!$isParticipant) {
        jsonResponse(['error' => 'Not a participant'], 403);
    }

    $conv = $db->fetch("SELECT * FROM conversations WHERE id = ?", [$convId]);
    if (!$conv) {
        jsonResponse(['error' => 'Conversation not found'], 404);
    }

    $participants = $db->fetchAll("
        SELECT u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen, u.public_key
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ?
    ", [$convId]);

    jsonResponse([
        'id' => $conv['id'],
        'type' => $conv['type'],
        'name' => $conv['name'],
        'createdAt' => $conv['created_at'],
        'participants' => array_map(function($p) {
            return [
                'id' => $p['id'],
                'username' => $p['username'],
                'displayName' => $p['display_name'],
                'avatarColor' => $p['avatar_color'],
                'status' => $p['status'],
                'lastSeen' => $p['last_seen'],
                'publicKey' => json_decode($p['public_key'], true)
            ];
        }, $participants)
    ]);
}
