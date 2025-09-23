# 🚀 Project Setup Guide

This guide will help you set up the **Automatic Accessibility Audit Tool** with a strong **Vite + TypeScript + Bootstrap** configuration.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 (or **yarn** >= 1.22.0)
- **Git** (for version control)

### Verify Installation

```bash
node --version  # Should be >= 18.0.0
npm --version   # Should be >= 9.0.0
git --version   # Any recent version
```

## 🛠️ Quick Setup

### Option 1: Automated Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd automatic-audit
   ```

2. **Run the startup script**
   ```bash
   ./start.sh
   ```

The startup script will:
- ✅ Check Node.js and npm versions
- ✅ Create `.env` file from template
- ✅ Install dependencies
- ✅ Verify TypeScript configuration
- ✅ Start development servers

### Option 2: Manual Setup

1. **Clone and navigate**
   ```bash
   git clone <repository-url>
   cd automatic-audit
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start development**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Edit `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Accesstive API Configuration
ACCESSTIVE_API_URL=https://api.accesstive.org/nsa-accesstive
ACCESSTIVE_API_KEY=your_api_key_here
ACCESSTIVE_AUTH_TOKEN=your_auth_token_here

# Frontend Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_TITLE=Automatic Accessibility Audit Tool
```

### Bootstrap Configuration

The project uses **Bootstrap 5.3.7** with the following setup:

```typescript
// src/main.ts
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
```

### Vite Configuration

The Vite config (`vite.config.ts`) includes:

- ✅ SCSS preprocessing with custom variables
- ✅ Bootstrap optimization
- ✅ API proxy configuration
- ✅ Path aliases (`@` for `src/`)
- ✅ Development server on port 5173

### TypeScript Configuration

Two separate TypeScript configs:

- **Frontend**: `tsconfig.json` - ES2022, strict mode
- **Backend**: `tsconfig.server.json` - Node.js environment

## 🏃‍♂️ Development Workflow

### Available Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Start both frontend and backend | Development |
| `npm run dev:frontend` | Start Vite dev server only | Frontend only |
| `npm run dev:server` | Start Express server only | Backend only |
| `npm run build` | Build for production | Production |
| `npm run type-check` | TypeScript type checking | Quality |
| `npm run preview` | Preview production build | Testing |

### Development URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Proxy**: Frontend automatically proxies `/api/*` to backend

### Hot Reload

- ✅ **Frontend**: Vite provides instant hot reload
- ✅ **Backend**: Nodemon auto-restarts on file changes
- ✅ **TypeScript**: Real-time type checking

## 🎨 Bootstrap Integration

### Custom Styling

The project extends Bootstrap with custom SCSS:

```scss
// src/styles/variables.scss
$primary-color: #667eea;
$success-color: #10b981;
$error-color: #dc3545;
// ... more variables

// src/styles/main.scss
@use 'sass:color';
@use './variables.scss' as *;
// ... custom styles
```

### Bootstrap Components Used

- **Grid System**: Responsive layouts
- **Components**: Cards, Buttons, Modals, Alerts, Badges
- **Utilities**: Spacing, Flexbox, Colors, Typography
- **JavaScript**: Modal functionality, Tooltips

### Custom Components

The project includes custom components that extend Bootstrap:

- Page cards with violation indicators
- Custom modals for detailed views
- Progress indicators and loading states
- Custom form styling

## 🔍 Quality Assurance

### TypeScript

```bash
# Type checking
npm run type-check        # Frontend types
npm run type-check:server # Backend types
```

### Build Verification

```bash
# Build and verify
npm run build
npm run preview
```

### Code Quality

The project includes:

- ✅ **TypeScript**: Strict type checking
- ✅ **ESLint**: Code linting (configurable)
- ✅ **Prettier**: Code formatting (configurable)
- ✅ **SCSS**: Preprocessed CSS with variables

## 🚀 Production Deployment

### Build Process

```bash
# Build everything
npm run build

# This creates:
# - dist/public/ (frontend assets)
# - dist/server/ (backend code)
```

### Production Start

```bash
# Start production server
npm start
```

### Environment Configuration

For production, update `.env`:

```env
NODE_ENV=production
PORT=3000
# ... other production settings
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change port in .env
   PORT=3001
   ```

2. **TypeScript Errors**
   ```bash
   # Clean and rebuild
   npm run clean
   npm install
   npm run build
   ```

3. **Bootstrap Not Loading**
   ```bash
   # Check imports in src/main.ts
   # Verify bootstrap is in package.json
   npm install bootstrap@5.3.7
   ```

4. **SCSS Compilation Errors**
   ```bash
   # Check SCSS syntax
   # Verify variables.scss imports
   ```

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
LOG_LEVEL=debug
```

## 📚 Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Bootstrap Documentation](https://getbootstrap.com/docs/)
- [SCSS Documentation](https://sass-lang.com/documentation)

## 🤝 Support

If you encounter issues:

1. Check this setup guide
2. Review the main README.md
3. Check existing GitHub issues
4. Create a new issue with detailed information

---

**Happy coding! 🎉** 