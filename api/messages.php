<?php
/**
 * Messages API Endpoints
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
        handleListMessages($db, $user);
        break;

    case 'send':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleSendMessage($db, $user);
        break;

    case 'read':
        if ($method !== 'POST') jsonResponse(['error' => 'Method not allowed'], 405);
        handleMarkAsRead($db, $user);
        break;

    default:
        jsonResponse(['error' => 'Invalid action'], 400);
}

function handleListMessages($db, $user) {
    $convId = intval($_GET['conversation_id'] ?? 0);
    $limit = intval($_GET['limit'] ?? 50);

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

    $messages = $db->fetchAll("
        SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_color as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ? AND m.is_deleted = 0
        ORDER BY m.created_at ASC
        LIMIT ?
    ", [$convId, $limit]);

    $result = array_map(function($m) {
        return [
            'id' => $m['id'],
            'conversationId' => $m['conversation_id'],
            'senderId' => $m['sender_id'],
            'senderUsername' => $m['sender_username'],
            'senderName' => $m['sender_name'],
            'senderAvatar' => $m['sender_avatar'],
            'content' => $m['content'],
            'contentType' => $m['content_type'],
            'status' => $m['status'],
            'createdAt' => $m['created_at']
        ];
    }, $messages);

    jsonResponse($result);
}

function handleSendMessage($db, $user) {
    $data = getJsonInput();

    $convId = intval($data['conversationId'] ?? 0);
    $content = $data['content'] ?? '';
    $contentType = sanitize($data['contentType'] ?? 'text');

    if (!$convId || empty($content)) {
        jsonResponse(['error' => 'Conversation ID and content required'], 400);
    }

    // Check if user is participant
    $isParticipant = $db->fetch(
        "SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
        [$convId, $user['id']]
    );

    if (!$isParticipant) {
        jsonResponse(['error' => 'Not a participant'], 403);
    }

    // Insert message
    $messageId = $db->insert(
        "INSERT INTO messages (conversation_id, sender_id, content, content_type, status) VALUES (?, ?, ?, ?, 'sent')",
        [$convId, $user['id'], $content, $contentType]
    );

    // Update conversation timestamp
    $db->update("UPDATE conversations SET updated_at = NOW() WHERE id = ?", [$convId]);

    // Get the message with sender info
    $message = $db->fetch("
        SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_color as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
    ", [$messageId]);

    jsonResponse([
        'id' => $message['id'],
        'conversationId' => $message['conversation_id'],
        'senderId' => $message['sender_id'],
        'senderUsername' => $message['sender_username'],
        'senderName' => $message['sender_name'],
        'senderAvatar' => $message['sender_avatar'],
        'content' => $message['content'],
        'contentType' => $message['content_type'],
        'status' => $message['status'],
        'createdAt' => $message['created_at']
    ], 201);
}

function handleMarkAsRead($db, $user) {
    $convId = intval($_GET['conversation_id'] ?? 0);

    if (!$convId) {
        jsonResponse(['error' => 'Conversation ID required'], 400);
    }

    $db->update(
        "UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?",
        [$convId, $user['id']]
    );

    jsonResponse(['success' => true]);
}
