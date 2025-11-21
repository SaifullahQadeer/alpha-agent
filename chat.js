/**
 * SecureChat - End-to-End Encrypted Messaging Application
 * Using Web Crypto API for RSA key exchange and AES-GCM encryption
 * Connected to SQL Database via REST API
 */

class SecureChatApp {
    constructor() {
        this.apiBase = '/api';
        this.currentUser = null;
        this.authToken = null;
        this.activeChat = null;
        this.activeConversationId = null;
        this.contacts = [];
        this.conversations = [];
        this.keys = {};
        this.theme = 'dark';
        this.pollingInterval = null;

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
        await this.checkAuth();
    }

    // ==================== API Helpers ====================

    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // ==================== Crypto Functions ====================

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

    async exportPublicKey(publicKey) {
        return await window.crypto.subtle.exportKey('jwk', publicKey);
    }

    async importPublicKey(jwk) {
        return await window.crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['encrypt']
        );
    }

    async generateAESKey() {
        return await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    }

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

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // ==================== Authentication ====================

    async checkAuth() {
        const token = localStorage.getItem('securechat_token');
        if (token) {
            this.authToken = token;
            try {
                const user = await this.apiRequest('/auth/me');
                this.currentUser = user;
                await this.loadUserData();
                this.showChatApp();
                this.startPolling();
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('securechat_token');
                this.showAuthScreen();
            }
        } else {
            this.showAuthScreen();
        }
    }

    async register(username, displayName, password) {
        // Generate key pair
        const keyPair = await this.generateKeyPair();
        const publicKeyJwk = await this.exportPublicKey(keyPair.publicKey);
        const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

        const response = await this.apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username,
                displayName,
                password,
                publicKey: publicKeyJwk
            })
        });

        this.authToken = response.token;
        this.currentUser = response.user;
        this.keys = {
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey
        };

        // Store token and private key
        localStorage.setItem('securechat_token', response.token);
        localStorage.setItem(`securechat_private_${username.toLowerCase()}`, JSON.stringify(privateKeyJwk));

        await this.loadUserData();
        this.showChatApp();
        this.startPolling();
        this.showToast('Account created successfully!', 'success');
    }

    async login(username, password) {
        const response = await this.apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        this.authToken = response.token;
        this.currentUser = response.user;

        // Restore private key
        const privateKeyJwk = JSON.parse(localStorage.getItem(`securechat_private_${username.toLowerCase()}`));
        if (privateKeyJwk) {
            this.keys.privateKey = await window.crypto.subtle.importKey(
                'jwk',
                privateKeyJwk,
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                true,
                ['decrypt']
            );
        }

        localStorage.setItem('securechat_token', response.token);

        await this.loadUserData();
        this.showChatApp();
        this.startPolling();
        this.showToast('Welcome back!', 'success');
    }

    async logout() {
        try {
            await this.apiRequest('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }

        this.stopPolling();
        localStorage.removeItem('securechat_token');
        this.authToken = null;
        this.currentUser = null;
        this.contacts = [];
        this.conversations = [];
        this.activeChat = null;
        this.activeConversationId = null;
        this.showAuthScreen();
        this.showToast('Logged out successfully', 'info');
    }

    async loadUserData() {
        try {
            // Load contacts
            this.contacts = await this.apiRequest('/contacts');

            // Load conversations
            this.conversations = await this.apiRequest('/conversations');
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    // ==================== Polling for new messages ====================

    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => this.pollUpdates(), 3000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async pollUpdates() {
        try {
            // Refresh conversations
            this.conversations = await this.apiRequest('/conversations');
            this.renderConversations();

            // If in a chat, refresh messages
            if (this.activeConversationId) {
                await this.loadMessages(this.activeConversationId);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
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
        avatar.style.background = this.currentUser.avatarColor || 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))';
        name.textContent = this.currentUser.displayName;

        // Update settings
        document.getElementById('settingsDisplayName').textContent = this.currentUser.displayName;
        document.getElementById('settingsUsername').textContent = '@' + this.currentUser.username;
    }

    renderConversations() {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '';

        if (this.conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-conversations">
                    <p style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        No conversations yet.<br>Add a contact to start chatting!
                    </p>
                </div>
            `;
            return;
        }

        this.conversations.forEach(conv => {
            const otherParticipant = conv.participants.find(p => p.username !== this.currentUser.username);
            if (!otherParticipant) return;

            const item = document.createElement('div');
            item.className = `conversation-item ${this.activeConversationId === conv.id ? 'active' : ''}`;
            item.dataset.conversationId = conv.id;
            item.dataset.username = otherParticipant.username;

            const lastMessage = conv.lastMessage;
            const isOnline = otherParticipant.status === 'online';

            item.innerHTML = `
                <div class="avatar ${isOnline ? 'online' : ''}" style="background: ${otherParticipant.avatarColor}">
                    <span>${this.getInitials(otherParticipant.displayName)}</span>
                </div>
                <div class="conversation-content">
                    <div class="conversation-header">
                        <span class="conversation-name">${this.escapeHtml(otherParticipant.displayName)}</span>
                        <span class="conversation-time">${lastMessage ? this.formatTime(lastMessage.createdAt) : ''}</span>
                    </div>
                    <div class="conversation-preview">
                        <span class="preview-text">${lastMessage ? this.escapeHtml(lastMessage.content) : 'No messages yet'}</span>
                        ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
                    </div>
                </div>
            `;

            item.addEventListener('click', () => this.openChat(otherParticipant.username, conv.id));
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

            const isOnline = contact.status === 'online';

            item.innerHTML = `
                <div class="avatar ${isOnline ? 'online' : ''}" style="background: ${contact.avatarColor}">
                    <span>${this.getInitials(contact.displayName)}</span>
                </div>
                <div class="contact-details">
                    <div class="contact-name">${this.escapeHtml(contact.displayName)}</div>
                    <div class="contact-username">@${this.escapeHtml(contact.username)}</div>
                </div>
            `;

            item.addEventListener('click', () => this.startConversation(contact.username));
            container.appendChild(item);
        });
    }

    async startConversation(username) {
        try {
            const response = await this.apiRequest('/conversations', {
                method: 'POST',
                body: JSON.stringify({ participantUsername: username })
            });

            await this.loadUserData();
            await this.openChat(username, response.id);
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async openChat(contactUsername, conversationId) {
        const contact = this.contacts.find(c => c.username === contactUsername);

        // If not in contacts, get from conversation participants
        let displayContact = contact;
        if (!displayContact) {
            const conv = this.conversations.find(c => c.id === conversationId);
            if (conv) {
                displayContact = conv.participants.find(p => p.username === contactUsername);
            }
        }

        if (!displayContact) {
            this.showToast('Contact not found', 'error');
            return;
        }

        this.activeChat = contactUsername;
        this.activeConversationId = conversationId;

        // Update UI
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('activeChat').classList.remove('hidden');

        // Update chat header
        const chatAvatar = document.getElementById('chatAvatar');
        chatAvatar.querySelector('span').textContent = this.getInitials(displayContact.displayName);
        chatAvatar.style.background = displayContact.avatarColor;
        document.getElementById('chatContactName').textContent = displayContact.displayName;

        const isOnline = displayContact.status === 'online';
        document.getElementById('lastSeen').textContent = isOnline ? 'Online' : this.formatLastSeen(displayContact.lastSeen);

        // Load messages
        await this.loadMessages(conversationId);

        // Mark as read
        await this.markAsRead(conversationId);

        // Update conversations list
        this.renderConversations();

        // Mobile: hide sidebar
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.add('hidden-mobile');
        }

        // Focus input
        document.getElementById('messageInput').focus();
    }

    async loadMessages(conversationId) {
        try {
            const messages = await this.apiRequest(`/conversations/${conversationId}/messages`);
            await this.renderMessages(messages);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    async renderMessages(messages) {
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';

        if (!messages || messages.length === 0) {
            container.innerHTML = `
                <div class="date-separator">
                    <span>Start of conversation</span>
                </div>
            `;
            return;
        }

        let lastDate = null;

        for (const message of messages) {
            const messageDate = new Date(message.createdAt).toDateString();

            // Add date separator if needed
            if (messageDate !== lastDate) {
                const separator = document.createElement('div');
                separator.className = 'date-separator';
                separator.innerHTML = `<span>${this.formatDate(message.createdAt)}</span>`;
                container.appendChild(separator);
                lastDate = messageDate;
            }

            const isSent = message.senderId === this.currentUser.id;

            const messageEl = document.createElement('div');
            messageEl.className = `message-group ${isSent ? 'sent' : 'received'}`;

            messageEl.innerHTML = `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-text">${this.escapeHtml(message.content)}</div>
                    <div class="message-meta">
                        <span class="message-time">${this.formatTime(message.createdAt)}</span>
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

        if (!text || !this.activeConversationId) return;

        try {
            // Send message to API
            const message = await this.apiRequest(`/conversations/${this.activeConversationId}/messages`, {
                method: 'POST',
                body: JSON.stringify({
                    content: text,
                    contentType: 'text'
                })
            });

            // Clear input
            input.value = '';
            this.autoResizeTextarea(input);

            // Reload messages
            await this.loadMessages(this.activeConversationId);

            // Update conversations list
            this.conversations = await this.apiRequest('/conversations');
            this.renderConversations();

            // Simulate response for demo
            this.simulateReply();
        } catch (error) {
            this.showToast('Failed to send message', 'error');
        }
    }

    async simulateReply() {
        if (!this.activeConversationId) return;

        // Show typing indicator
        const typingIndicator = document.getElementById('typingIndicator');
        const lastSeen = document.getElementById('lastSeen');
        typingIndicator.classList.remove('hidden');
        lastSeen.classList.add('hidden');

        // Wait for "typing"
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

        typingIndicator.classList.add('hidden');
        lastSeen.classList.remove('hidden');

        // Note: In a real app, replies would come from the other user via the server
        // This is just for demonstration purposes
    }

    async markAsRead(conversationId) {
        try {
            await this.apiRequest(`/conversations/${conversationId}/read`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    }

    async addContact(username) {
        const response = await this.apiRequest('/contacts', {
            method: 'POST',
            body: JSON.stringify({ username })
        });

        this.contacts.push(response);
        this.renderContacts();
        this.showToast(`${response.displayName} added to contacts`, 'success');

        return response;
    }

    async deleteContact(username) {
        await this.apiRequest(`/contacts/${username}`, {
            method: 'DELETE'
        });

        this.contacts = this.contacts.filter(c => c.username !== username);

        if (this.activeChat === username) {
            this.activeChat = null;
            this.activeConversationId = null;
            document.getElementById('activeChat').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
        }

        this.renderContacts();
        this.renderConversations();
        this.showToast('Contact removed', 'info');
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
        this.activeConversationId = null;
        document.getElementById('activeChat').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
        document.querySelector('.sidebar').classList.remove('hidden-mobile');
        this.renderConversations();
    }

    showContactInfo() {
        if (!this.activeChat) return;

        const contact = this.contacts.find(c => c.username === this.activeChat);
        if (!contact) {
            // Try to find from conversation
            const conv = this.conversations.find(c => c.id === this.activeConversationId);
            if (!conv) return;
            const participant = conv.participants.find(p => p.username === this.activeChat);
            if (!participant) return;

            document.getElementById('contactInfoAvatar').querySelector('span').textContent = this.getInitials(participant.displayName);
            document.getElementById('contactInfoAvatar').style.background = participant.avatarColor;
            document.getElementById('contactInfoName').textContent = participant.displayName;
            document.getElementById('contactInfoUsername').textContent = '@' + participant.username;
            document.getElementById('contactAddedDate').textContent = 'Connected via conversation';
        } else {
            document.getElementById('contactInfoAvatar').querySelector('span').textContent = this.getInitials(contact.displayName);
            document.getElementById('contactInfoAvatar').style.background = contact.avatarColor;
            document.getElementById('contactInfoName').textContent = contact.displayName;
            document.getElementById('contactInfoUsername').textContent = '@' + contact.username;
            document.getElementById('contactAddedDate').textContent = new Date(contact.addedAt).toLocaleDateString();
        }

        this.openModal('contactInfoModal');
    }

    async handleDeleteContact() {
        if (!this.activeChat) return;
        await this.deleteContact(this.activeChat);
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

    async clearAllData() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            // In a real app, this would call an API to delete user data
            this.contacts = [];
            this.conversations = [];
            this.activeChat = null;
            this.activeConversationId = null;

            document.getElementById('activeChat').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');

            this.renderContacts();
            this.renderConversations();
            this.closeModal('settingsModal');
            this.showToast('Local data cleared', 'info');
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

    formatLastSeen(timestamp) {
        if (!timestamp) return 'Last seen recently';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Last seen just now';
        if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;

        return `Last seen ${date.toLocaleDateString()}`;
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
