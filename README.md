# SecureChat - End-to-End Encrypted Messaging

A professional, real-time chat application with end-to-end encryption, built with Node.js, Express, and SQLite.

## Features

### Security
- **End-to-End Encryption**: Messages encrypted using AES-256-GCM
- **RSA Key Exchange**: 2048-bit RSA-OAEP for secure key exchange
- **Password Hashing**: bcrypt with 12 rounds for secure password storage
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

- **Backend**: Node.js with Express.js
- **Database**: SQLite with better-sqlite3
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with CSS Variables
- **Authentication**: bcryptjs + UUID tokens
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
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | Search users |
| GET | `/api/users/:username` | Get user profile |
| PUT | `/api/users/profile` | Update profile |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List contacts |
| POST | `/api/contacts` | Add contact |
| DELETE | `/api/contacts/:username` | Remove contact |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Start conversation |
| GET | `/api/conversations/:id` | Get conversation |
| GET | `/api/conversations/:id/messages` | Get messages |
| POST | `/api/conversations/:id/messages` | Send message |
| POST | `/api/conversations/:id/read` | Mark as read |

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/SaifullahQadeer/alpha-agent.git
cd alpha-agent
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser:
```
http://localhost:3000
```

## Deployment on Hostinger

### Node.js Frontend Web App Setup

1. **Connect Repository**: Link your GitHub repository in Hostinger
2. **Build Settings**:
   - Build command: `npm install`
   - Start command: `npm start`
3. **Environment**: Node.js 18+
4. **Port**: The app uses `process.env.PORT` or defaults to 3000

### Environment Variables (Optional)
```
PORT=3000
NODE_ENV=production
```

## Project Structure

```
alpha-agent/
├── chat.html          # Main chat interface
├── chat.css           # Styles and themes
├── chat.js            # Frontend application logic
├── server.js          # Express.js API server
├── package.json       # Node.js dependencies
├── database/
│   └── init.js        # Database schema initialization
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
- Passwords are hashed with bcrypt (12 rounds)

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
