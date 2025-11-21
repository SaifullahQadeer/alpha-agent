/**
 * SecureChat Server
 * Express.js API server with sql.js (pure JavaScript SQLite)
 * Compatible with Hostinger Node.js hosting
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Database instance
let db = null;
const DB_PATH = path.join(__dirname, 'database', 'securechat.db');

// Initialize database
async function initDatabase() {
    const SQL = await initSqlJs();

    // Try to load existing database
    try {
        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
            console.log('Loaded existing database');
        } else {
            db = new SQL.Database();
            console.log('Created new database');
        }
    } catch (err) {
        db = new SQL.Database();
        console.log('Created new database (error loading existing)');
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            public_key TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#6366f1',
            status TEXT DEFAULT 'offline',
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            nickname TEXT,
            is_blocked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, contact_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT DEFAULT 'direct',
            name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS conversation_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_read_at DATETIME,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(conversation_id, user_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            content_type TEXT DEFAULT 'text',
            iv TEXT,
            encrypted_key TEXT,
            status TEXT DEFAULT 'sent',
            is_deleted INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS message_read_receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(message_id, user_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            device_info TEXT,
            ip_address TEXT,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

    saveDatabase();
    console.log('Database initialized successfully');
}

// Save database to file
function saveDatabase() {
    try {
        const data = db.export();
        const buffer = Buffer.from(data);

        // Ensure directory exists
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('Error saving database:', err);
    }
}

// Helper function to run queries
function dbRun(sql, params = []) {
    try {
        db.run(sql, params);
        saveDatabase();
        return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
    } catch (err) {
        console.error('DB Run Error:', err);
        throw err;
    }
}

function dbGet(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
        }
        stmt.free();
        return null;
    } catch (err) {
        console.error('DB Get Error:', err);
        return null;
    }
}

function dbAll(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    } catch (err) {
        console.error('DB All Error:', err);
        return [];
    }
}

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

    const session = dbGet(`
        SELECT s.*, u.id as user_id, u.username, u.display_name, u.public_key, u.avatar_color
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > datetime('now')
    `, [token]);

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

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, displayName, password, publicKey } = req.body;

        if (!username || !displayName || !password || !publicKey) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existingUser = dbGet('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#10b981'];
        const avatarColor = colors[Math.floor(Math.random() * colors.length)];

        dbRun(`
            INSERT INTO users (username, display_name, password_hash, public_key, avatar_color, status)
            VALUES (?, ?, ?, ?, ?, 'online')
        `, [username.toLowerCase(), displayName, passwordHash, JSON.stringify(publicKey), avatarColor]);

        const user = dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        dbRun(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [user.id, token, expiresAt]);

        res.status(201).json({
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
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        dbRun(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`, [user.id, token, expiresAt]);
        dbRun(`UPDATE users SET status = 'online', last_seen = datetime('now') WHERE id = ?`, [user.id]);

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

app.post('/api/auth/logout', authenticateToken, (req, res) => {
    try {
        dbRun('DELETE FROM sessions WHERE token = ?', [req.token]);
        dbRun(`UPDATE users SET status = 'offline', last_seen = datetime('now') WHERE id = ?`, [req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const user = dbGet(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
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
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ==================== USER ROUTES ====================

app.get('/api/users/search', authenticateToken, (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);

        const users = dbAll(`
            SELECT id, username, display_name, avatar_color, status, last_seen
            FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? LIMIT 20
        `, [`%${q}%`, `%${q}%`, req.user.id]);

        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.display_name,
            avatarColor: u.avatar_color,
            status: u.status,
            lastSeen: u.last_seen
        })));
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/users/:username', authenticateToken, (req, res) => {
    try {
        const user = dbGet(`SELECT * FROM users WHERE username = ?`, [req.params.username.toLowerCase()]);
        if (!user) return res.status(404).json({ error: 'User not found' });

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
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ==================== CONTACT ROUTES ====================

app.get('/api/contacts', authenticateToken, (req, res) => {
    try {
        const contacts = dbAll(`
            SELECT c.*, u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen, u.public_key
            FROM contacts c
            JOIN users u ON c.contact_id = u.id
            WHERE c.user_id = ?
            ORDER BY u.display_name ASC
        `, [req.user.id]);

        res.json(contacts.map(c => ({
            id: c.id,
            username: c.username,
            displayName: c.nickname || c.display_name,
            avatarColor: c.avatar_color,
            status: c.status,
            lastSeen: c.last_seen,
            publicKey: JSON.parse(c.public_key),
            isBlocked: c.is_blocked === 1,
            addedAt: c.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get contacts' });
    }
});

app.post('/api/contacts', authenticateToken, (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        const contactUser = dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
        if (!contactUser) return res.status(404).json({ error: 'User not found' });
        if (contactUser.id === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });

        const existing = dbGet('SELECT id FROM contacts WHERE user_id = ? AND contact_id = ?', [req.user.id, contactUser.id]);
        if (existing) return res.status(409).json({ error: 'Contact already exists' });

        dbRun('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)', [req.user.id, contactUser.id]);

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
        res.status(500).json({ error: 'Failed to add contact' });
    }
});

app.delete('/api/contacts/:username', authenticateToken, (req, res) => {
    try {
        const contactUser = dbGet('SELECT id FROM users WHERE username = ?', [req.params.username.toLowerCase()]);
        if (!contactUser) return res.status(404).json({ error: 'User not found' });

        dbRun('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?', [req.user.id, contactUser.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

// ==================== CONVERSATION ROUTES ====================

app.get('/api/conversations', authenticateToken, (req, res) => {
    try {
        const conversations = dbAll(`
            SELECT DISTINCT c.id, c.type, c.name, c.updated_at
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = ?
            ORDER BY c.updated_at DESC
        `, [req.user.id]);

        const result = conversations.map(conv => {
            const participants = dbAll(`
                SELECT u.id, u.username, u.display_name, u.avatar_color, u.status, u.last_seen
                FROM conversation_participants cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.conversation_id = ?
            `, [conv.id]);

            const lastMessage = dbGet(`
                SELECT m.*, u.display_name as sender_name
                FROM messages m JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = ?
                ORDER BY m.created_at DESC LIMIT 1
            `, [conv.id]);

            const unreadCount = dbGet(`
                SELECT COUNT(*) as count FROM messages m
                LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ?
                WHERE m.conversation_id = ? AND m.sender_id != ?
                AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
            `, [req.user.id, conv.id, req.user.id]);

            return {
                id: conv.id,
                type: conv.type,
                name: conv.name,
                updatedAt: conv.updated_at,
                unreadCount: unreadCount?.count || 0,
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

app.post('/api/conversations', authenticateToken, (req, res) => {
    try {
        const { participantUsername } = req.body;
        if (!participantUsername) return res.status(400).json({ error: 'Participant username required' });

        const participant = dbGet('SELECT * FROM users WHERE username = ?', [participantUsername.toLowerCase()]);
        if (!participant) return res.status(404).json({ error: 'User not found' });

        // Check existing conversation
        const existingConv = dbGet(`
            SELECT c.id FROM conversations c
            JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
            JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
            WHERE c.type = 'direct' AND cp1.user_id = ? AND cp2.user_id = ?
        `, [req.user.id, participant.id]);

        if (existingConv) {
            return res.json({ id: existingConv.id, type: 'direct', isNew: false });
        }

        dbRun(`INSERT INTO conversations (type) VALUES ('direct')`);
        const conv = dbGet(`SELECT * FROM conversations ORDER BY id DESC LIMIT 1`);

        dbRun('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [conv.id, req.user.id]);
        dbRun('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [conv.id, participant.id]);

        res.status(201).json({
            id: conv.id,
            type: 'direct',
            createdAt: conv.created_at,
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

// ==================== MESSAGE ROUTES ====================

app.get('/api/conversations/:id/messages', authenticateToken, (req, res) => {
    try {
        const conversationId = parseInt(req.params.id);
        const { limit = 50 } = req.query;

        const isParticipant = dbGet(`
            SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?
        `, [conversationId, req.user.id]);
        if (!isParticipant) return res.status(403).json({ error: 'Not a participant' });

        const messages = dbAll(`
            SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_color as sender_avatar
            FROM messages m JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ? AND m.is_deleted = 0
            ORDER BY m.created_at ASC LIMIT ?
        `, [conversationId, parseInt(limit)]);

        res.json(messages.map(m => ({
            id: m.id,
            conversationId: m.conversation_id,
            senderId: m.sender_id,
            senderUsername: m.sender_username,
            senderName: m.sender_name,
            senderAvatar: m.sender_avatar,
            content: m.content,
            contentType: m.content_type,
            status: m.status,
            createdAt: m.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

app.post('/api/conversations/:id/messages', authenticateToken, (req, res) => {
    try {
        const conversationId = parseInt(req.params.id);
        const { content, contentType = 'text' } = req.body;
        if (!content) return res.status(400).json({ error: 'Message content required' });

        const isParticipant = dbGet(`
            SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?
        `, [conversationId, req.user.id]);
        if (!isParticipant) return res.status(403).json({ error: 'Not a participant' });

        dbRun(`
            INSERT INTO messages (conversation_id, sender_id, content, content_type, status)
            VALUES (?, ?, ?, ?, 'sent')
        `, [conversationId, req.user.id, content, contentType]);

        dbRun(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, [conversationId]);

        const message = dbGet(`
            SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_color as sender_avatar
            FROM messages m JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT 1
        `, [conversationId]);

        res.status(201).json({
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            senderUsername: message.sender_username,
            senderName: message.sender_name,
            senderAvatar: message.sender_avatar,
            content: message.content,
            contentType: message.content_type,
            status: message.status,
            createdAt: message.created_at
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.post('/api/conversations/:id/read', authenticateToken, (req, res) => {
    try {
        const conversationId = parseInt(req.params.id);
        dbRun(`
            UPDATE conversation_participants SET last_read_at = datetime('now')
            WHERE conversation_id = ? AND user_id = ?
        `, [conversationId, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// Serve chat app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

// Start server
async function startServer() {
    await initDatabase();

    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║   SecureChat Server Running                               ║
║   Local:    http://localhost:${PORT}                        ║
╚═══════════════════════════════════════════════════════════╝
        `);
    });
}

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    if (db) {
        saveDatabase();
        db.close();
    }
    process.exit(0);
});

module.exports = app;
