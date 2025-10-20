# Alpha Agent Dashboard

A modern, feature-rich dashboard application with AI-powered insights using Google's Gemini AI.

## Features

- **Beautiful UI Design**: Modern, responsive design with Tailwind CSS
- **Interactive Charts**: Line charts, bar charts, and doughnut charts using Chart.js
- **Gemini AI Integration**: AI-powered insights and chat interface
- **Real-time Statistics**: Dynamic stat cards showing key metrics
- **Recent Activity Feed**: Track important events and updates
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Smooth Animations**: Engaging user experience with smooth transitions

## Tech Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Chart.js**: Interactive charts and data visualization
- **Gemini AI**: Google's advanced AI model for insights
- **Lucide Icons**: Beautiful, consistent icon set

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

The application will open at `http://localhost:3000`

### Build for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
alpha-agent/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx          # Main dashboard container
│   │   ├── Header.jsx              # Top navigation header
│   │   ├── Sidebar.jsx             # Side navigation menu
│   │   ├── StatsCards.jsx          # Statistics cards
│   │   ├── ChartsSection.jsx       # Charts visualization
│   │   ├── AIInsights.jsx          # Gemini AI insights & chat
│   │   └── RecentActivity.jsx      # Activity feed
│   ├── services/
│   │   └── geminiService.js        # Gemini AI integration
│   ├── App.jsx                     # Root component
│   ├── main.jsx                    # Application entry point
│   └── index.css                   # Global styles
├── public/                         # Static assets
├── index.html                      # HTML template
├── vite.config.js                  # Vite configuration
├── tailwind.config.js              # Tailwind CSS configuration
└── package.json                    # Project dependencies

```

## Features Overview

### Dashboard

- **Revenue & Expenses Trend**: Line chart showing financial trends over time
- **Weekly Active Users**: Bar chart displaying user activity
- **Device Usage**: Doughnut chart showing device distribution
- **Key Metrics**: Cards displaying revenue, users, performance, and growth

### AI Assistant

The dashboard integrates Google's Gemini AI to provide:

- Automated dashboard insights and summaries
- Interactive chat interface for queries
- Data analysis capabilities
- Predictive insights

### Responsive Design

- Mobile-first approach
- Collapsible sidebar on mobile devices
- Adaptive layouts for all screen sizes
- Touch-friendly interface

## Customization

### Changing Colors

Edit `tailwind.config.js` to customize the color scheme:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        // Your custom colors
      }
    }
  }
}
```

### Adding New Charts

1. Import chart type from `react-chartjs-2`
2. Create chart data and options
3. Add to `ChartsSection.jsx`

### Modifying AI Behavior

Edit `src/services/geminiService.js` to customize AI prompts and responses.

## API Configuration

The Gemini AI API key is configured in `src/services/geminiService.js`. For production use, consider using environment variables:

```javascript
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
```

## Performance

- Optimized bundle size with tree-shaking
- Lazy loading for better performance
- Efficient re-renders with React hooks
- CSS purging in production builds

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with React, Tailwind CSS, and Gemini AI