# SecureChat - End-to-End Encrypted Messaging

A professional, real-time chat application with end-to-end encryption, built with PHP, MySQL, and vanilla JavaScript.

## Features

### Security
- **End-to-End Encryption**: Messages encrypted using AES-256-GCM
- **RSA Key Exchange**: 2048-bit RSA-OAEP for secure key exchange
- **Password Hashing**: bcrypt for secure password storage
- **Token Authentication**: UUID-based session tokens with 7-day expiry

### Core Features
- **User Authentication**: Register, login, and secure session management
- **Contact Management**: Add, search, and manage contacts
- **Real-time Messaging**: Send and receive messages instantly
- **Message Status**: Track sent, delivered, and read status
- **Typing Indicators**: See when contacts are typing
- **Conversation History**: Full message history with date separators

### User Interface
- **Modern Dark Theme**: Professional dark UI with light theme option
- **Responsive Design**: Works on desktop and mobile devices
- **Emoji Picker**: Built-in emoji support with categories
- **Search**: Search through contacts and conversations
- **Notifications**: Toast notifications for actions and events

## Technology Stack

- **Backend**: PHP 7.4+ with PDO
- **Database**: MySQL / MariaDB
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with CSS Variables
- **Authentication**: password_hash() + UUID tokens
- **Encryption**: Web Crypto API

## Database Schema

```sql
users              - User accounts with encrypted public keys
contacts           - User relationships and contact lists
conversations      - Chat conversations (direct messages)
conversation_participants - Conversation membership
messages           - Encrypted messages with metadata
message_read_receipts - Read receipt tracking
sessions           - Authentication sessions
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `api/auth.php?action=register` | Create new account |
| POST | `api/auth.php?action=login` | User login |
| POST | `api/auth.php?action=logout` | User logout |
| GET | `api/auth.php?action=me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `api/users.php?action=search&q=` | Search users |
| GET | `api/users.php?action=get&username=` | Get user profile |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `api/contacts.php?action=list` | List contacts |
| POST | `api/contacts.php?action=add` | Add contact |
| DELETE | `api/contacts.php?action=delete&username=` | Remove contact |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `api/conversations.php?action=list` | List conversations |
| POST | `api/conversations.php?action=create` | Start conversation |
| GET | `api/messages.php?action=list&conversation_id=` | Get messages |
| POST | `api/messages.php?action=send` | Send message |
| POST | `api/messages.php?action=read&conversation_id=` | Mark as read |

## Installation

### Prerequisites
- PHP 7.4+ with PDO extension
- MySQL 5.7+ or MariaDB 10.3+
- Web server (Apache/Nginx)

### Shared Hosting Setup (Hostinger)

1. **Upload Files**: Upload all files to your `public_html` folder via FTP or File Manager

2. **Create Database**:
   - Go to phpMyAdmin in Hostinger
   - Create a new database
   - Import `database/schema.sql` to create tables

3. **Configure Database**:
   - Edit `config/database.php`
   - Update credentials:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'your_database_name');
   define('DB_USER', 'your_username');
   define('DB_PASS', 'your_password');
   ```

4. **Access the App**:
   ```
   https://yourdomain.com/chat.html
   ```

## Project Structure

```
alpha-agent/
├── chat.html          # Main chat interface
├── chat.css           # Styles and themes
├── chat.js            # Frontend application logic
├── api/               # PHP API endpoints
│   ├── auth.php       # Authentication
│   ├── contacts.php   # Contacts management
│   ├── conversations.php # Conversations
│   ├── messages.php   # Messages
│   └── users.php      # User search
├── config/
│   └── database.php   # Database configuration
├── includes/
│   ├── Database.php   # PDO database class
│   └── functions.php  # Helper functions
├── database/
│   └── schema.sql     # MySQL schema
└── README.md          # Documentation
```

## Usage

### Getting Started

1. **Create Account**: Click "Create Account" and fill in your details
2. **Add Contacts**: Go to Contacts tab and add users by username
3. **Start Chatting**: Click on a contact to start a conversation
4. **Send Messages**: Type your message and press Enter or click Send

### Features Guide

- **Search**: Use the search bar to find contacts or conversations
- **Themes**: Go to Settings to switch between dark/light themes
- **Emoji**: Click the emoji button to add emojis to messages
- **Contact Info**: Click the info button to view contact details

## Security Notes

- All messages are encrypted client-side before transmission
- Private keys are stored locally in the browser
- Session tokens expire after 7 days
- Passwords are hashed with bcrypt

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT License - feel free to use for personal or commercial projects.

## Support

For issues or questions, please open an issue on GitHub.

---

**Built for secure, private communication**
