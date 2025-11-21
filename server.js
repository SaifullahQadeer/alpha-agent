/**
 * SecureChat Server
 * Express.js API server with SQLite database
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const { initializeDatabase, DB_PATH } = require('./database/init');

// Initialize database
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const session = db.prepare(`
        SELECT s.*, u.id as user_id, u.username, u.display_name, u.public_key, u.avatar_color
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);

    if (!session) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = {
        id: session.user_id,
        username: session.username,
        displayName: session.display_name,
        publicKey: session.public_key,
        avatarColor: session.avatar_color
    };
    req.token = token;
    next();
};

// ==================== AUTH ROUTES ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, displayName, password, publicKey } = req.body;

        if (!username || !displayName || !password || !publicKey) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if username exists
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate avatar color
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#10b981'];
        const avatarColor = colors[Math.floor(Math.random() * colors.length)];

        // Insert user
        const result = db.prepare(`
            INSERT INTO users (username, display_name, password_hash, public_key, avatar_color, status)
            VALUES (?, ?, ?, ?, ?, 'online')
        `).run(username.toLowerCase(), displayName, passwordHash, JSON.stringify(publicKey), avatarColor);

        const userId = result.lastInsertRowid;

        // Create session token
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

        db.prepare(`
            INSERT INTO sessions (user_id, token, expires_at)
            VALUES (?, ?, ?)
        `).run(userId, token, expiresAt);

        // Update user status
        db.prepare('UPDATE users SET status = ?, last_seen = datetime("now") WHERE id = ?')
            .run('online', userId);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: userId,
                username: username.toLowerCase(),
                displayName,
                publicKey,
                avatarColor
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase());
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create session token
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        db.prepare(`
            INSERT INTO sessions (user_id, token, expires_at)
            VALUES (?, ?, ?)
        `).run(user.id, token, expiresAt);

        // Update user status
        db.prepare('UPDATE users SET status = ?, last_seen = datetime("now") WHERE id = ?')
            .run('online', user.id);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                publicKey: JSON.parse(user.public_key),
                avatarColor: user.avatar_color
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    try {
        // Delete session
        db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);

        // Update user status
        db.prepare('UPDATE users SET status = ?, last_seen = datetime("now") WHERE id = ?')
            .run('offline', req.user.id);

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT id, username, display_name, public_key, avatar_color, status, last_seen, created_at
            FROM users WHERE id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            publicKey: JSON.parse(user.public_key),
            avatarColor: user.avatar_color,
            status: user.status,
            lastSeen: user.last_seen,
            createdAt: user.created_at
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ==================== USER ROUTES ====================

// Search users
app.get('/api/users/search', authenticateToken, (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        const users = db.prepare(`
            SELECT id, username, display_name, avatar_color, status, last_seen
            FROM users
            WHERE (username LIKE ? OR display_name LIKE ?)
            AND id != ?
            LIMIT 20
        `).all(`%${q}%`, `%${q}%`, req.user.id);

        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.display_name,
            avatarColor: u.avatar_color,
            status: u.status,
            lastSeen: u.last_seen
        })));
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get user by username
app.get('/api/users/:username', authenticateToken, (req, res) => {
    try {
        const user = db.prepare(`
            SELECT id, username, display_name, public_key, avatar_color, status, last_seen
            FROM users WHERE username = ?
        `).get(req.params.username.toLowerCase());

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            publicKey: JSON.parse(user.public_key),
            avatarColor: user.avatar_color,
            status: user.status,
            lastSeen: user.last_seen
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Update user profile
app.put('/api/users/profile', authenticateToken, (req, res) => {
    try {
        const { displayName, avatarColor } = req.body;

        const updates = [];
        const params = [];

        if (displayName) {
            updates.push('display_name = ?');
            params.push(displayName);
        }
        if (avatarColor) {
            updates.push('avatar_color = ?');
            params.push(avatarColor);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        updates.push('updated_at = datetime("now")');
        params.push(req.user.id);

        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        res.json({ success: true });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ==================== CONTACT ROUTES ====================

// Get all contacts
app.get('/api/contacts', authenticateToken, (req, res) => {
    try {
        const contacts = db.prepare(`
            SELECT c.id as contact_relation_id, c.nickname, c.is_blocked, c.created_at as added_at,
                   u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen, u.public_key
            FROM contacts c
            JOIN users u ON c.contact_id = u.id
            WHERE c.user_id = ?
            ORDER BY u.display_name ASC
        `).all(req.user.id);

        res.json(contacts.map(c => ({
            id: c.id,
            username: c.username,
            displayName: c.nickname || c.display_name,
            avatarColor: c.avatar_color,
            status: c.status,
            lastSeen: c.last_seen,
            publicKey: JSON.parse(c.public_key),
            isBlocked: c.is_blocked === 1,
            addedAt: c.added_at
        })));
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Failed to get contacts' });
    }
});

// Add contact
app.post('/api/contacts', authenticateToken, (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username required' });
        }

        // Find user to add
        const contactUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase());
        if (!contactUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (contactUser.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot add yourself as contact' });
        }

        // Check if already a contact
        const existing = db.prepare('SELECT id FROM contacts WHERE user_id = ? AND contact_id = ?')
            .get(req.user.id, contactUser.id);
        if (existing) {
            return res.status(409).json({ error: 'Contact already exists' });
        }

        // Add contact (both directions for mutual contact)
        db.prepare('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)')
            .run(req.user.id, contactUser.id);

        res.status(201).json({
            id: contactUser.id,
            username: contactUser.username,
            displayName: contactUser.display_name,
            avatarColor: contactUser.avatar_color,
            status: contactUser.status,
            lastSeen: contactUser.last_seen,
            publicKey: JSON.parse(contactUser.public_key),
            isBlocked: false,
            addedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Add contact error:', error);
        res.status(500).json({ error: 'Failed to add contact' });
    }
});

// Delete contact
app.delete('/api/contacts/:username', authenticateToken, (req, res) => {
    try {
        const contactUser = db.prepare('SELECT id FROM users WHERE username = ?')
            .get(req.params.username.toLowerCase());

        if (!contactUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?')
            .run(req.user.id, contactUser.id);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

// ==================== CONVERSATION ROUTES ====================

// Get all conversations
app.get('/api/conversations', authenticateToken, (req, res) => {
    try {
        const conversations = db.prepare(`
            SELECT DISTINCT c.id, c.type, c.name, c.updated_at,
                   cp.last_read_at,
                   (
                       SELECT COUNT(*) FROM messages m
                       WHERE m.conversation_id = c.id
                       AND m.sender_id != ?
                       AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
                   ) as unread_count
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = ?
            ORDER BY c.updated_at DESC
        `).all(req.user.id, req.user.id);

        // Get participants and last message for each conversation
        const result = conversations.map(conv => {
            const participants = db.prepare(`
                SELECT u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen
                FROM conversation_participants cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.conversation_id = ?
            `).all(conv.id);

            const lastMessage = db.prepare(`
                SELECT m.*, u.display_name as sender_name
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = ?
                ORDER BY m.created_at DESC
                LIMIT 1
            `).get(conv.id);

            return {
                id: conv.id,
                type: conv.type,
                name: conv.name,
                updatedAt: conv.updated_at,
                unreadCount: conv.unread_count,
                participants: participants.map(p => ({
                    id: p.id,
                    username: p.username,
                    displayName: p.display_name,
                    avatarColor: p.avatar_color,
                    status: p.status,
                    lastSeen: p.last_seen
                })),
                lastMessage: lastMessage ? {
                    id: lastMessage.id,
                    content: lastMessage.content,
                    senderId: lastMessage.sender_id,
                    senderName: lastMessage.sender_name,
                    createdAt: lastMessage.created_at,
                    status: lastMessage.status
                } : null
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// Get or create conversation with user
app.post('/api/conversations', authenticateToken, (req, res) => {
    try {
        const { participantUsername } = req.body;

        if (!participantUsername) {
            return res.status(400).json({ error: 'Participant username required' });
        }

        const participant = db.prepare('SELECT * FROM users WHERE username = ?')
            .get(participantUsername.toLowerCase());

        if (!participant) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if conversation already exists
        const existingConv = db.prepare(`
            SELECT c.id FROM conversations c
            JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
            JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
            WHERE c.type = 'direct'
            AND cp1.user_id = ? AND cp2.user_id = ?
        `).get(req.user.id, participant.id);

        if (existingConv) {
            // Return existing conversation
            const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(existingConv.id);
            return res.json({
                id: conv.id,
                type: conv.type,
                createdAt: conv.created_at,
                isNew: false
            });
        }

        // Create new conversation
        const result = db.prepare(`
            INSERT INTO conversations (type) VALUES ('direct')
        `).run();

        const conversationId = result.lastInsertRowid;

        // Add participants
        db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)')
            .run(conversationId, req.user.id);
        db.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)')
            .run(conversationId, participant.id);

        res.status(201).json({
            id: conversationId,
            type: 'direct',
            createdAt: new Date().toISOString(),
            isNew: true,
            participant: {
                id: participant.id,
                username: participant.username,
                displayName: participant.display_name,
                avatarColor: participant.avatar_color,
                publicKey: JSON.parse(participant.public_key)
            }
        });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

// Get conversation by ID
app.get('/api/conversations/:id', authenticateToken, (req, res) => {
    try {
        const conversationId = parseInt(req.params.id);

        // Check if user is participant
        const isParticipant = db.prepare(`
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = ? AND user_id = ?
        `).get(conversationId, req.user.id);

        if (!isParticipant) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const participants = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen, u.public_key
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
        `).all(conversationId);

        res.json({
            id: conversation.id,
            type: conversation.type,
            name: conversation.name,
            createdAt: conversation.created_at,
            participants: participants.map(p => ({
                id: p.id,
                username: p.username,
                displayName: p.display_name,
                avatarColor: p.avatar_color,
                status: p.status,
                lastSeen: p.last_seen,
                publicKey: JSON.parse(p.public_key)
            }))
        });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ error: 'Failed to get conversation' });
    }
});

// ==================== MESSAGE ROUTES ====================

// Get messages for a conversation
app.get('/api/conversations/:id/messages', authenticateToken, (req, res) => {
    try {
        const conversationId = parseInt(req.params.id);
        const { limit = 50, before } = req.query;

        // Check if user is participant
        const isParticipant = db.prepare(`
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = ? AND user_id = ?
        `).get(conversationId, req.user.id);

        if (!isParticipant) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        let query = `
            SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_color as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ? AND m.is_deleted = 0
        `;
        const params = [conversationId];

        if (before) {
            query += ' AND m.id < ?';
            params.push(before);
        }

        query += ' ORDER BY m.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const messages = db.prepare(query).all(...params);

        // Get read receipts for each message
        const result = messages.map(m => {
            const readBy = db.prepare(`
                SELECT u.id, u.username, mrr.read_at
                FROM message_read_receipts mrr
                JOIN users u ON mrr.user_id = u.id
                WHERE mrr.message_id = ?
            `).all(m.id);

            return {
                id: m.id,
                conversationId: m.conversation_id,
                senderId: m.sender_id,
                senderUsername: m.sender_username,
                senderName: m.sender_name,
                senderAvatar: m.sender_avatar,
                content: m.content,
                contentType: m.content_type,
                iv: m.iv,
                encryptedKey: m.encrypted_key,
                status: m.status,
                createdAt: m.created_at,
                readBy: readBy
            };
        }).reverse(); // Reverse to get chronological order

        res.json(result);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Send message
app.post('/api/conversations/:id/messages', authenticateToken, (req, res) => {
    try {
        const conversationId = parseInt(req.params.id);
        const { content, iv, encryptedKey, contentType = 'text' } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Message content required' });
        }

        // Check if user is participant
        const isParticipant = db.prepare(`
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = ? AND user_id = ?
        `).get(conversationId, req.user.id);

        if (!isParticipant) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        // Insert message
        const result = db.prepare(`
            INSERT INTO messages (conversation_id, sender_id, content, content_type, iv, encrypted_key, status)
            VALUES (?, ?, ?, ?, ?, ?, 'sent')
        `).run(conversationId, req.user.id, content, contentType, iv, encryptedKey);

        const messageId = result.lastInsertRowid;

        // Update conversation timestamp
        db.prepare('UPDATE conversations SET updated_at = datetime("now") WHERE id = ?')
            .run(conversationId);

        // Get full message
        const message = db.prepare(`
            SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_color as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        `).get(messageId);

        res.status(201).json({
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            senderUsername: message.sender_username,
            senderName: message.sender_name,
            senderAvatar: message.sender_avatar,
            content: message.content,
            contentType: message.content_type,
            iv: message.iv,
            encryptedKey: message.encrypted_key,
            status: message.status,
            createdAt: message.created_at
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Mark messages as read
app.post('/api/conversations/:id/read', authenticateToken, (req, res) => {
    try {
        const conversationId = parseInt(req.params.id);

        // Check if user is participant
        const isParticipant = db.prepare(`
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = ? AND user_id = ?
        `).get(conversationId, req.user.id);

        if (!isParticipant) {
            return res.status(403).json({ error: 'Not a participant in this conversation' });
        }

        // Update last read timestamp
        db.prepare(`
            UPDATE conversation_participants
            SET last_read_at = datetime('now')
            WHERE conversation_id = ? AND user_id = ?
        `).run(conversationId, req.user.id);

        // Get unread messages from others
        const unreadMessages = db.prepare(`
            SELECT m.id FROM messages m
            LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_id = ?
            WHERE m.conversation_id = ? AND m.sender_id != ? AND mrr.id IS NULL
        `).all(req.user.id, conversationId, req.user.id);

        // Create read receipts
        const insertReceipt = db.prepare(`
            INSERT OR IGNORE INTO message_read_receipts (message_id, user_id)
            VALUES (?, ?)
        `);

        const updateStatus = db.prepare(`
            UPDATE messages SET status = 'read' WHERE id = ?
        `);

        for (const msg of unreadMessages) {
            insertReceipt.run(msg.id, req.user.id);
            updateStatus.run(msg.id);
        }

        res.json({ success: true, readCount: unreadMessages.length });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// Update message status
app.put('/api/messages/:id/status', authenticateToken, (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { status } = req.body;

        if (!['sent', 'delivered', 'read'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        db.prepare('UPDATE messages SET status = ?, updated_at = datetime("now") WHERE id = ?')
            .run(status, messageId);

        res.json({ success: true });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// ==================== STATS ROUTES ====================

// Get user statistics
app.get('/api/stats', authenticateToken, (req, res) => {
    try {
        const totalMessages = db.prepare(`
            SELECT COUNT(*) as count FROM messages WHERE sender_id = ?
        `).get(req.user.id);

        const totalContacts = db.prepare(`
            SELECT COUNT(*) as count FROM contacts WHERE user_id = ?
        `).get(req.user.id);

        const totalConversations = db.prepare(`
            SELECT COUNT(*) as count FROM conversation_participants WHERE user_id = ?
        `).get(req.user.id);

        const recentActivity = db.prepare(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM messages
            WHERE sender_id = ?
            AND created_at > datetime('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `).all(req.user.id);

        res.json({
            totalMessages: totalMessages.count,
            totalContacts: totalContacts.count,
            totalConversations: totalConversations.count,
            recentActivity
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Get all users (admin/debug)
app.get('/api/admin/users', authenticateToken, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT id, username, display_name, avatar_color, status, last_seen, created_at
            FROM users
            ORDER BY created_at DESC
        `).all();

        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.display_name,
            avatarColor: u.avatar_color,
            status: u.status,
            lastSeen: u.last_seen,
            createdAt: u.created_at
        })));
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Serve chat app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   SecureChat Server Running                               ║
║   ─────────────────────────────────────────               ║
║                                                           ║
║   Local:    http://localhost:${PORT}                        ║
║   API:      http://localhost:${PORT}/api                    ║
║                                                           ║
║   Database: ${DB_PATH}    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close();
    process.exit(0);
});

module.exports = app;
