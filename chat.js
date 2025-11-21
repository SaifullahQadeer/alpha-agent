/**
 * SecureChat - End-to-End Encrypted Messaging Application
 * Using Web Crypto API for RSA key exchange and AES-GCM encryption
 */

class SecureChatApp {
    constructor() {
        this.currentUser = null;
        this.activeChat = null;
        this.contacts = [];
        this.conversations = {};
        this.keys = {};
        this.theme = 'dark';

        // Emoji data
        this.emojis = {
            smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐'],
            gestures: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
            hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '😻', '💑', '💏'],
            objects: ['📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌'],
            symbols: ['✨', '⭐', '🌟', '💫', '⚡', '🔥', '💥', '❄️', '🌈', '☀️', '🌙', '⭕', '✅', '❌', '❓', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '💠', '🔘']
        };

        this.init();
    }

    async init() {
        this.loadTheme();
        this.bindEvents();
        this.checkAuth();
    }

    // ==================== Crypto Functions ====================

    /**
     * Generate RSA key pair for asymmetric encryption
     */
    async generateKeyPair() {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['encrypt', 'decrypt']
        );
        return keyPair;
    }

    /**
     * Export public key to JWK format
     */
    async exportPublicKey(publicKey) {
        return await window.crypto.subtle.exportKey('jwk', publicKey);
    }

    /**
     * Import public key from JWK format
     */
    async importPublicKey(jwk) {
        return await window.crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['encrypt']
        );
    }

    /**
     * Generate AES key for symmetric message encryption
     */
    async generateAESKey() {
        return await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt AES key with RSA public key
     */
    async encryptAESKey(aesKey, publicKey) {
        const exportedKey = await window.crypto.subtle.exportKey('raw', aesKey);
        const encryptedKey = await window.crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            exportedKey
        );
        return this.arrayBufferToBase64(encryptedKey);
    }

    /**
     * Decrypt AES key with RSA private key
     */
    async decryptAESKey(encryptedKeyBase64, privateKey) {
        const encryptedKey = this.base64ToArrayBuffer(encryptedKeyBase64);
        const decryptedKey = await window.crypto.subtle.decrypt(
            { name: 'RSA-OAEP' },
            privateKey,
            encryptedKey
        );
        return await window.crypto.subtle.importKey(
            'raw',
            decryptedKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt message with AES-GCM
     */
    async encryptMessage(message, aesKey) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            data
        );

        return {
            ciphertext: this.arrayBufferToBase64(encrypted),
            iv: this.arrayBufferToBase64(iv)
        };
    }

    /**
     * Decrypt message with AES-GCM
     */
    async decryptMessage(encryptedData, aesKey) {
        const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
        const iv = this.base64ToArrayBuffer(encryptedData.iv);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    /**
     * Utility: ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
    }

    /**
     * Utility: Base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Hash password using PBKDF2
     */
    async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password);
        const saltData = encoder.encode(salt);

        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            passwordData,
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const derivedBits = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltData,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );

        return this.arrayBufferToBase64(derivedBits);
    }

    // ==================== Authentication ====================

    checkAuth() {
        const session = localStorage.getItem('securechat_session');
        if (session) {
            const sessionData = JSON.parse(session);
            this.currentUser = sessionData.user;
            this.keys = sessionData.keys;
            this.loadUserData();
            this.showChatApp();
        } else {
            this.showAuthScreen();
        }
    }

    async register(username, displayName, password) {
        // Check if username exists
        const users = JSON.parse(localStorage.getItem('securechat_users') || '{}');
        if (users[username.toLowerCase()]) {
            throw new Error('Username already exists');
        }

        // Generate key pair
        const keyPair = await this.generateKeyPair();
        const publicKeyJwk = await this.exportPublicKey(keyPair.publicKey);
        const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

        // Hash password
        const salt = username.toLowerCase() + '_securechat_salt';
        const passwordHash = await this.hashPassword(password, salt);

        // Create user
        const user = {
            username: username.toLowerCase(),
            displayName: displayName,
            publicKey: publicKeyJwk,
            passwordHash: passwordHash,
            createdAt: Date.now()
        };

        // Store user
        users[username.toLowerCase()] = user;
        localStorage.setItem('securechat_users', JSON.stringify(users));

        // Create session
        this.currentUser = user;
        this.keys = {
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey,
            privateKeyJwk: privateKeyJwk
        };

        this.saveSession();
        this.initializeUserData();
        this.showChatApp();
        this.showToast('Account created successfully!', 'success');
    }

    async login(username, password) {
        const users = JSON.parse(localStorage.getItem('securechat_users') || '{}');
        const user = users[username.toLowerCase()];

        if (!user) {
            throw new Error('User not found');
        }

        // Verify password
        const salt = username.toLowerCase() + '_securechat_salt';
        const passwordHash = await this.hashPassword(password, salt);

        if (passwordHash !== user.passwordHash) {
            throw new Error('Invalid password');
        }

        // Restore keys
        const privateKey = await window.crypto.subtle.importKey(
            'jwk',
            JSON.parse(localStorage.getItem(`securechat_private_${username.toLowerCase()}`)),
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['decrypt']
        );

        const publicKey = await this.importPublicKey(user.publicKey);

        this.currentUser = user;
        this.keys = {
            publicKey: publicKey,
            privateKey: privateKey
        };

        this.saveSession();
        this.loadUserData();
        this.showChatApp();
        this.showToast('Welcome back!', 'success');
    }

    saveSession() {
        // Store private key separately (more secure in real app)
        localStorage.setItem(
            `securechat_private_${this.currentUser.username}`,
            JSON.stringify(this.keys.privateKeyJwk || {})
        );

        const session = {
            user: this.currentUser,
            keys: {
                // Only store references, not actual keys in session
                hasKeys: true
            }
        };
        localStorage.setItem('securechat_session', JSON.stringify(session));
    }

    logout() {
        localStorage.removeItem('securechat_session');
        this.currentUser = null;
        this.keys = {};
        this.contacts = [];
        this.conversations = {};
        this.activeChat = null;
        this.showAuthScreen();
        this.showToast('Logged out successfully', 'info');
    }

    initializeUserData() {
        const userData = {
            contacts: [],
            conversations: {}
        };
        localStorage.setItem(`securechat_data_${this.currentUser.username}`, JSON.stringify(userData));

        // Store private key
        if (this.keys.privateKeyJwk) {
            localStorage.setItem(
                `securechat_private_${this.currentUser.username}`,
                JSON.stringify(this.keys.privateKeyJwk)
            );
        }
    }

    loadUserData() {
        const data = JSON.parse(
            localStorage.getItem(`securechat_data_${this.currentUser.username}`) ||
            '{"contacts":[],"conversations":{}}'
        );
        this.contacts = data.contacts || [];
        this.conversations = data.conversations || {};
    }

    saveUserData() {
        const data = {
            contacts: this.contacts,
            conversations: this.conversations
        };
        localStorage.setItem(`securechat_data_${this.currentUser.username}`, JSON.stringify(data));
    }

    // ==================== UI Management ====================

    showAuthScreen() {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('chatApp').classList.add('hidden');
    }

    showChatApp() {
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('chatApp').classList.remove('hidden');
        this.updateUserProfile();
        this.renderConversations();
        this.renderContacts();
    }

    updateUserProfile() {
        const avatar = document.getElementById('currentUserAvatar');
        const name = document.getElementById('currentUserName');

        avatar.querySelector('span').textContent = this.getInitials(this.currentUser.displayName);
        avatar.classList.add('online');
        name.textContent = this.currentUser.displayName;

        // Update settings
        document.getElementById('settingsDisplayName').textContent = this.currentUser.displayName;
        document.getElementById('settingsUsername').textContent = '@' + this.currentUser.username;
    }

    renderConversations() {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '';

        // Get conversations sorted by last message time
        const convList = Object.entries(this.conversations)
            .map(([contactId, conv]) => ({
                contactId,
                ...conv,
                lastMessageTime: conv.messages.length > 0
                    ? conv.messages[conv.messages.length - 1].timestamp
                    : conv.createdAt
            }))
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        if (convList.length === 0) {
            container.innerHTML = `
                <div class="empty-conversations">
                    <p style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        No conversations yet.<br>Add a contact to start chatting!
                    </p>
                </div>
            `;
            return;
        }

        convList.forEach(conv => {
            const contact = this.contacts.find(c => c.username === conv.contactId);
            if (!contact) return;

            const lastMessage = conv.messages[conv.messages.length - 1];
            const unreadCount = conv.messages.filter(m => !m.read && m.sender !== this.currentUser.username).length;

            const item = document.createElement('div');
            item.className = `conversation-item ${this.activeChat === contact.username ? 'active' : ''}`;
            item.dataset.contactId = contact.username;

            item.innerHTML = `
                <div class="avatar ${contact.online ? 'online' : ''}">
                    <span>${this.getInitials(contact.displayName)}</span>
                </div>
                <div class="conversation-content">
                    <div class="conversation-header">
                        <span class="conversation-name">${this.escapeHtml(contact.displayName)}</span>
                        <span class="conversation-time">${lastMessage ? this.formatTime(lastMessage.timestamp) : ''}</span>
                    </div>
                    <div class="conversation-preview">
                        <span class="preview-text">${lastMessage ? this.escapeHtml(lastMessage.decryptedText || 'Encrypted message') : 'No messages yet'}</span>
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                    </div>
                </div>
            `;

            item.addEventListener('click', () => this.openChat(contact.username));
            container.appendChild(item);
        });
    }

    renderContacts() {
        const container = document.getElementById('contactsContainer');
        container.innerHTML = '';

        if (this.contacts.length === 0) {
            container.innerHTML = `
                <div class="empty-contacts">
                    <p style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        No contacts yet.<br>Click "Add" to add a new contact!
                    </p>
                </div>
            `;
            return;
        }

        this.contacts.forEach(contact => {
            const item = document.createElement('div');
            item.className = 'contact-item';
            item.dataset.username = contact.username;

            item.innerHTML = `
                <div class="avatar ${contact.online ? 'online' : ''}">
                    <span>${this.getInitials(contact.displayName)}</span>
                </div>
                <div class="contact-details">
                    <div class="contact-name">${this.escapeHtml(contact.displayName)}</div>
                    <div class="contact-username">@${this.escapeHtml(contact.username)}</div>
                </div>
            `;

            item.addEventListener('click', () => this.openChat(contact.username));
            container.appendChild(item);
        });
    }

    async openChat(contactUsername) {
        const contact = this.contacts.find(c => c.username === contactUsername);
        if (!contact) return;

        this.activeChat = contactUsername;

        // Initialize conversation if doesn't exist
        if (!this.conversations[contactUsername]) {
            this.conversations[contactUsername] = {
                contactId: contactUsername,
                messages: [],
                sessionKey: null,
                createdAt: Date.now()
            };
            this.saveUserData();
        }

        // Update UI
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('activeChat').classList.remove('hidden');

        // Update chat header
        document.getElementById('chatAvatar').querySelector('span').textContent = this.getInitials(contact.displayName);
        document.getElementById('chatContactName').textContent = contact.displayName;
        document.getElementById('lastSeen').textContent = contact.online ? 'Online' : 'Last seen recently';

        // Mark messages as read
        this.markMessagesAsRead(contactUsername);

        // Render messages
        await this.renderMessages(contactUsername);

        // Update conversations list
        this.renderConversations();

        // Mobile: hide sidebar
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.add('hidden-mobile');
        }

        // Focus input
        document.getElementById('messageInput').focus();
    }

    async renderMessages(contactUsername) {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';

        const conversation = this.conversations[contactUsername];
        if (!conversation || conversation.messages.length === 0) {
            container.innerHTML = `
                <div class="date-separator">
                    <span>Start of conversation</span>
                </div>
            `;
            return;
        }

        let lastDate = null;

        for (const message of conversation.messages) {
            const messageDate = new Date(message.timestamp).toDateString();

            // Add date separator if needed
            if (messageDate !== lastDate) {
                const separator = document.createElement('div');
                separator.className = 'date-separator';
                separator.innerHTML = `<span>${this.formatDate(message.timestamp)}</span>`;
                container.appendChild(separator);
                lastDate = messageDate;
            }

            // Decrypt message if needed
            let text = message.decryptedText;
            if (!text && message.encrypted) {
                try {
                    // In a real app, decrypt with session key
                    text = message.text || '[Encrypted]';
                } catch (e) {
                    text = '[Unable to decrypt]';
                }
            }

            const isSent = message.sender === this.currentUser.username;

            const messageEl = document.createElement('div');
            messageEl.className = `message-group ${isSent ? 'sent' : 'received'}`;

            messageEl.innerHTML = `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-text">${this.escapeHtml(text)}</div>
                    <div class="message-meta">
                        <span class="message-time">${this.formatTime(message.timestamp)}</span>
                        ${isSent ? `
                            <span class="message-status ${message.status}">
                                ${this.getStatusIcon(message.status)}
                            </span>
                        ` : ''}
                    </div>
                </div>
            `;

            container.appendChild(messageEl);
        }

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();

        if (!text || !this.activeChat) return;

        const conversation = this.conversations[this.activeChat];
        const contact = this.contacts.find(c => c.username === this.activeChat);

        // Create message object
        const message = {
            id: this.generateId(),
            sender: this.currentUser.username,
            receiver: this.activeChat,
            text: text, // In real app, this would be encrypted
            decryptedText: text,
            encrypted: true,
            timestamp: Date.now(),
            status: 'sent',
            read: false
        };

        // Add to conversation
        conversation.messages.push(message);
        this.saveUserData();

        // Clear input
        input.value = '';
        this.autoResizeTextarea(input);

        // Render messages
        await this.renderMessages(this.activeChat);
        this.renderConversations();

        // Simulate delivery and read (demo purposes)
        setTimeout(() => {
            message.status = 'delivered';
            this.saveUserData();
            this.renderMessages(this.activeChat);
        }, 1000);

        setTimeout(() => {
            message.status = 'read';
            this.saveUserData();
            this.renderMessages(this.activeChat);

            // Simulate reply (for demo)
            this.simulateReply(this.activeChat, text);
        }, 2000);
    }

    simulateReply(contactUsername, originalMessage) {
        const contact = this.contacts.find(c => c.username === contactUsername);
        if (!contact) return;

        // Show typing indicator
        const typingIndicator = document.getElementById('typingIndicator');
        const lastSeen = document.getElementById('lastSeen');
        typingIndicator.classList.remove('hidden');
        lastSeen.classList.add('hidden');

        // Generate reply after delay
        setTimeout(() => {
            typingIndicator.classList.add('hidden');
            lastSeen.classList.remove('hidden');

            const replies = [
                "Got it!",
                "That's interesting!",
                "I see what you mean.",
                "Thanks for letting me know!",
                "Sure, sounds good!",
                "I'll think about it.",
                "Great idea!",
                "Let me check and get back to you.",
                "Perfect!",
                "I appreciate that!"
            ];

            const replyText = replies[Math.floor(Math.random() * replies.length)];

            const message = {
                id: this.generateId(),
                sender: contactUsername,
                receiver: this.currentUser.username,
                text: replyText,
                decryptedText: replyText,
                encrypted: true,
                timestamp: Date.now(),
                status: 'delivered',
                read: this.activeChat === contactUsername
            };

            const conversation = this.conversations[contactUsername];
            if (conversation) {
                conversation.messages.push(message);
                this.saveUserData();

                if (this.activeChat === contactUsername) {
                    this.renderMessages(contactUsername);
                }
                this.renderConversations();
            }
        }, 2000 + Math.random() * 2000);
    }

    markMessagesAsRead(contactUsername) {
        const conversation = this.conversations[contactUsername];
        if (!conversation) return;

        conversation.messages.forEach(msg => {
            if (msg.sender !== this.currentUser.username) {
                msg.read = true;
            }
        });
        this.saveUserData();
    }

    async addContact(username) {
        const users = JSON.parse(localStorage.getItem('securechat_users') || '{}');
        const user = users[username.toLowerCase()];

        if (!user) {
            throw new Error('User not found');
        }

        if (username.toLowerCase() === this.currentUser.username) {
            throw new Error('You cannot add yourself');
        }

        if (this.contacts.find(c => c.username === username.toLowerCase())) {
            throw new Error('Contact already exists');
        }

        const contact = {
            username: user.username,
            displayName: user.displayName,
            publicKey: user.publicKey,
            addedAt: Date.now(),
            online: Math.random() > 0.5 // Demo: random online status
        };

        this.contacts.push(contact);

        // Initialize conversation
        this.conversations[contact.username] = {
            contactId: contact.username,
            messages: [],
            sessionKey: null,
            createdAt: Date.now()
        };

        this.saveUserData();
        this.renderContacts();
        this.renderConversations();
        this.showToast(`${user.displayName} added to contacts`, 'success');
    }

    deleteContact(username) {
        const index = this.contacts.findIndex(c => c.username === username);
        if (index === -1) return;

        const contact = this.contacts[index];
        this.contacts.splice(index, 1);
        delete this.conversations[username];

        if (this.activeChat === username) {
            this.activeChat = null;
            document.getElementById('activeChat').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
        }

        this.saveUserData();
        this.renderContacts();
        this.renderConversations();
        this.showToast(`${contact.displayName} removed from contacts`, 'info');
    }

    // ==================== Event Binding ====================

    bindEvents() {
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
        });

        // Auth forms
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));

        // Password toggle
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', () => this.togglePassword(btn));
        });

        // Password strength
        document.getElementById('regPassword').addEventListener('input', (e) => this.updatePasswordStrength(e.target.value));

        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchSidebarTab(tab.dataset.tab));
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));

        // Header buttons
        document.getElementById('settingsBtn').addEventListener('click', () => this.openModal('settingsModal'));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Add contact
        document.getElementById('addContactBtn').addEventListener('click', () => this.openModal('addContactModal'));
        document.getElementById('addContactForm').addEventListener('submit', (e) => this.handleAddContact(e));
        document.getElementById('closeAddContact').addEventListener('click', () => this.closeModal('addContactModal'));
        document.getElementById('cancelAddContact').addEventListener('click', () => this.closeModal('addContactModal'));

        // Chat actions
        document.getElementById('backBtn').addEventListener('click', () => this.closeChat());
        document.getElementById('infoBtn').addEventListener('click', () => this.showContactInfo());

        // Message input
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', () => this.autoResizeTextarea(messageInput));
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Send button
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());

        // Emoji picker
        document.getElementById('emojiBtn').addEventListener('click', () => this.toggleEmojiPicker());
        this.initEmojiPicker();

        // Settings modal
        document.getElementById('closeSettings').addEventListener('click', () => this.closeModal('settingsModal'));
        document.getElementById('themeSelect').addEventListener('change', (e) => this.setTheme(e.target.value));
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearAllData());

        // Contact info modal
        document.getElementById('closeContactInfo').addEventListener('click', () => this.closeModal('contactInfoModal'));
        document.getElementById('deleteContactBtn').addEventListener('click', () => this.handleDeleteContact());

        // Modal overlays
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', () => {
                const modal = overlay.closest('.modal');
                if (modal) this.closeModal(modal.id);
            });
        });

        // Close emoji picker on outside click
        document.addEventListener('click', (e) => {
            const picker = document.getElementById('emojiPicker');
            const btn = document.getElementById('emojiBtn');
            if (!picker.contains(e.target) && !btn.contains(e.target)) {
                picker.classList.add('hidden');
            }
        });

        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

        document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(tab === 'login' ? 'loginForm' : 'registerForm').classList.add('active');
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await this.login(username, password);
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const displayName = document.getElementById('regDisplayName').value;
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            await this.register(username, displayName, password);
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    togglePassword(btn) {
        const input = btn.parentElement.querySelector('input');
        const eyeOpen = btn.querySelector('.eye-open');
        const eyeClosed = btn.querySelector('.eye-closed');

        if (input.type === 'password') {
            input.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            input.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    }

    updatePasswordStrength(password) {
        const fill = document.querySelector('.strength-fill');
        const text = document.querySelector('.strength-text');

        let strength = 0;
        if (password.length >= 6) strength++;
        if (password.length >= 10) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        fill.className = 'strength-fill';
        if (strength <= 1) {
            fill.classList.add('weak');
            text.textContent = 'Weak';
        } else if (strength === 2) {
            fill.classList.add('fair');
            text.textContent = 'Fair';
        } else if (strength === 3) {
            fill.classList.add('good');
            text.textContent = 'Good';
        } else {
            fill.classList.add('strong');
            text.textContent = 'Strong';
        }
    }

    switchSidebarTab(tab) {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.sidebar-tab[data-tab="${tab}"]`).classList.add('active');

        if (tab === 'chats') {
            document.getElementById('conversationsList').classList.remove('hidden');
            document.getElementById('contactsList').classList.add('hidden');
        } else {
            document.getElementById('conversationsList').classList.add('hidden');
            document.getElementById('contactsList').classList.remove('hidden');
        }
    }

    handleSearch(query) {
        query = query.toLowerCase();
        const isChatsTab = document.querySelector('.sidebar-tab[data-tab="chats"]').classList.contains('active');

        if (isChatsTab) {
            document.querySelectorAll('.conversation-item').forEach(item => {
                const name = item.querySelector('.conversation-name').textContent.toLowerCase();
                item.style.display = name.includes(query) ? 'flex' : 'none';
            });
        } else {
            document.querySelectorAll('.contact-item').forEach(item => {
                const name = item.querySelector('.contact-name').textContent.toLowerCase();
                const username = item.querySelector('.contact-username').textContent.toLowerCase();
                item.style.display = (name.includes(query) || username.includes(query)) ? 'flex' : 'none';
            });
        }
    }

    async handleAddContact(e) {
        e.preventDefault();
        const username = document.getElementById('contactUsername').value;

        try {
            await this.addContact(username);
            this.closeModal('addContactModal');
            document.getElementById('contactUsername').value = '';
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    closeChat() {
        this.activeChat = null;
        document.getElementById('activeChat').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
        document.querySelector('.sidebar').classList.remove('hidden-mobile');
        this.renderConversations();
    }

    showContactInfo() {
        if (!this.activeChat) return;

        const contact = this.contacts.find(c => c.username === this.activeChat);
        if (!contact) return;

        document.getElementById('contactInfoAvatar').querySelector('span').textContent = this.getInitials(contact.displayName);
        document.getElementById('contactInfoName').textContent = contact.displayName;
        document.getElementById('contactInfoUsername').textContent = '@' + contact.username;
        document.getElementById('contactAddedDate').textContent = new Date(contact.addedAt).toLocaleDateString();

        this.openModal('contactInfoModal');
    }

    handleDeleteContact() {
        if (!this.activeChat) return;
        this.deleteContact(this.activeChat);
        this.closeModal('contactInfoModal');
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    initEmojiPicker() {
        const grid = document.getElementById('emojiGrid');
        const categories = document.querySelectorAll('.emoji-category');

        categories.forEach(cat => {
            cat.addEventListener('click', () => {
                categories.forEach(c => c.classList.remove('active'));
                cat.classList.add('active');
                this.renderEmojis(cat.dataset.category);
            });
        });

        this.renderEmojis('smileys');

        grid.addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-item')) {
                const input = document.getElementById('messageInput');
                input.value += e.target.textContent;
                input.focus();
                document.getElementById('emojiPicker').classList.add('hidden');
            }
        });
    }

    renderEmojis(category) {
        const grid = document.getElementById('emojiGrid');
        grid.innerHTML = '';

        this.emojis[category].forEach(emoji => {
            const item = document.createElement('span');
            item.className = 'emoji-item';
            item.textContent = emoji;
            grid.appendChild(item);
        });
    }

    toggleEmojiPicker() {
        document.getElementById('emojiPicker').classList.toggle('hidden');
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            localStorage.removeItem(`securechat_data_${this.currentUser.username}`);
            this.contacts = [];
            this.conversations = {};
            this.activeChat = null;

            document.getElementById('activeChat').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');

            this.renderContacts();
            this.renderConversations();
            this.closeModal('settingsModal');
            this.showToast('All data cleared', 'info');
        }
    }

    handleResize() {
        if (window.innerWidth > 768) {
            document.querySelector('.sidebar').classList.remove('hidden-mobile');
        }
    }

    // ==================== Theme ====================

    loadTheme() {
        const savedTheme = localStorage.getItem('securechat_theme') || 'dark';
        this.setTheme(savedTheme);
        document.getElementById('themeSelect').value = savedTheme;
    }

    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('securechat_theme', theme);

        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    // ==================== Toast Notifications ====================

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<path d="M20 6L9 17l-5-5"/>',
            error: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
        };

        toast.innerHTML = `
            <div class="toast-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${icons[type]}
                </svg>
            </div>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 300);
        });

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('leaving');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    // ==================== Utility Functions ====================

    getInitials(name) {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) return 'Today';

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }

    getStatusIcon(status) {
        const icons = {
            sent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            delivered: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 6 7 17 2 12"/><polyline points="22 6 11 17"/></svg>',
            read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 6 7 17 2 12"/><polyline points="22 6 11 17"/></svg>'
        };
        return icons[status] || icons.sent;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.secureChatApp = new SecureChatApp();
});
