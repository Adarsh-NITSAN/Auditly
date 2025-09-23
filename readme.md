# 🔍 Automatic Accessibility Audit Tool

A comprehensive web accessibility auditing tool that automatically crawls websites, analyzes pages for WCAG compliance, and generates detailed accessibility reports. Built with modern web technologies for optimal performance and user experience.

## ✨ Features

- **🌐 Smart Website Crawling**: Automatically discovers pages using both link extraction and sitemap.xml parsing
- **♿ WCAG Compliance Testing**: Comprehensive accessibility testing using Accesstive API
- **📊 Detailed Reporting**: Generate detailed accessibility reports with violation summaries
- **🎯 Multi-Page Auditing**: Audit multiple pages simultaneously with progress tracking
- **📱 Responsive Design**: Modern, mobile-friendly interface built with Bootstrap 5
- **⚡ Real-time Progress**: Live progress indicators and status updates
- **🔍 Custom URL Support**: Add custom URLs for targeted auditing
- **📈 Audit History**: Track and compare audit results over time
- **🌍 Multi-language Support**: Crawl and audit multilingual websites

## 🚀 Tech Stack

### Frontend
- **Framework**: Vite + TypeScript
- **UI Framework**: Bootstrap 5.3.7
- **Styling**: SCSS with custom theming
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **Web Crawling**: Cheerio + Axios
- **Security**: Helmet.js + CORS

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 or **yarn** >= 1.22.0

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd automatic-audit
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Environment Setup
```bash
cp env.example .env
```

Edit the `.env` file with your configuration:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Crawler Settings
MAX_PAGES_TO_CRAWL=100
CRAWL_DELAY=1000
REQUEST_TIMEOUT=30000

# Accesstive API (for accessibility testing)
ACCESSTIVE_API_KEY=your_api_key_here
ACCESSTIVE_API_URL=https://api.accesstive.org
```

## 🏃‍♂️ Quick Start

### Development Mode
```bash
npm run dev
```
This starts both frontend (port 5173) and backend (port 3000) servers.

### Production Build
```bash
npm run build
npm start
```

## 📖 Usage Guide

### 1. Start the Application
```bash
npm run dev
```
Open your browser to `http://localhost:5173`

### 2. Enter Website URL
- Enter the main URL of the website you want to audit
- Set the maximum number of pages to crawl (1-500)
- Click "Start Crawling"

### 3. Review Discovered Pages
- The crawler will discover pages using:
  - Link extraction from HTML
  - Sitemap.xml parsing (if available)
- Select which pages to audit
- Add custom URLs if needed

### 4. Run Accessibility Audit
- Click "Start Audit" to begin accessibility testing
- Monitor real-time progress
- View results as they complete

### 5. Review Results
- **Summary**: Overview of violations by severity
- **Page Details**: Individual page results
- **Violation Details**: Specific accessibility issues found
- **Export**: Download reports in JSON or CSV format

## 🏗️ Project Structure

```
automatic-audit/
├── src/                    # Frontend source
│   ├── app.ts             # Main application logic
│   ├── main.ts            # Entry point with Bootstrap
│   ├── index.html         # HTML template
│   └── styles/
│       └── main.scss      # Custom SCSS styles
├── server/                # Backend source
│   ├── server.ts          # Express server setup
│   ├── services/          # Business logic
│   │   ├── crawlerService.ts    # Website crawling
│   │   ├── auditService.ts      # Accessibility testing
│   │   └── reportService.ts     # Report generation
│   └── types/             # TypeScript definitions
├── dist/                  # Build output
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config
└── package.json           # Dependencies & scripts
```

## 🔧 Configuration

### Vite Configuration
- **Development Server**: Port 5173
- **API Proxy**: Routes `/api/*` to backend
- **SCSS Processing**: Custom variables and Bootstrap integration
- **Build Output**: Optimized for production

### TypeScript Configuration
- **Frontend**: ES2022 target, strict mode
- **Backend**: Node.js environment, ES modules

### Crawler Settings
- **Max Pages**: Configurable limit (1-500)
- **Crawl Delay**: Respectful delays between requests
- **Timeout**: Configurable request timeouts
- **User Agent**: Professional crawler identification

## 📡 API Endpoints

### Core Endpoints
- `GET /api/health` - Server health check
- `POST /api/crawl` - Crawl website for pages
- `POST /api/audit` - Run accessibility audit
- `GET /api/audit-history` - Get audit history
- `POST /api/report` - Generate detailed reports

### Request Examples

#### Crawl Website
```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"mainUrl": "https://example.com", "maxPages": 10}'
```

#### Run Audit
```bash
curl -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"pages": ["https://example.com", "https://example.com/about"]}'
```

## 🎨 Customization

### Styling
The application uses Bootstrap 5 with custom SCSS variables:
```scss
:root {
  --bs-primary: #667eea;
  --bs-secondary: #764ba2;
  --bs-success: #10b981;
  // ... more custom variables
}
```

### Crawler Behavior
Modify crawler settings in `server/services/crawlerService.ts`:
- URL filtering patterns
- Request headers
- Crawl delays
- Domain restrictions

## 🧪 Testing

### Manual Testing
1. **Crawling**: Test with various website structures
2. **Auditing**: Verify accessibility testing accuracy
3. **Reporting**: Check report generation and export
4. **UI/UX**: Test responsive design and interactions

### API Testing
```bash
# Health check
curl http://localhost:3000/api/health

# Test crawling
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"mainUrl": "https://example.com", "maxPages": 5}'
```

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development servers |
| `npm run dev:frontend` | Start Vite dev server only |
| `npm run dev:server` | Start Express server only |
| `npm run build` | Build for production |
| `npm run build:server` | Build backend only |
| `npm run build:frontend` | Build frontend only |
| `npm start` | Start production server |
| `npm run clean` | Clean build directory |

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input Validation**: Request sanitization
- **Rate Limiting**: Configurable request limits
- **Error Handling**: Graceful error responses

## 📊 Performance Optimizations

- **Vite**: Fast development and optimized builds
- **Tree Shaking**: Remove unused code
- **SCSS Compilation**: Optimized CSS output
- **Static Asset Optimization**: Compressed and cached
- **API Caching**: Intelligent response caching

## 🐛 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if port is in use
lsof -i :3000
# Kill process if needed
kill -9 <PID>
```

#### Build Errors
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

#### Crawling Issues
- Check network connectivity
- Verify URL accessibility
- Review crawler logs
- Adjust timeout settings

### Debug Mode
Enable detailed logging by setting `NODE_ENV=development` in `.env`

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Bootstrap** for the responsive UI framework
- **Vite** for the fast build tool
- **Accesstive** for accessibility testing capabilities
- **Cheerio** for HTML parsing
- **Express** for the web server framework

## 📞 Support

For support and questions:
1. Check the [documentation](#)
2. Search [existing issues](#)
3. Create a [new issue](#) with detailed information

---

**Built with ❤️ for better web accessibility**

*Making the web accessible, one audit at a time.*
  