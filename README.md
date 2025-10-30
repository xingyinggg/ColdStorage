# ColdStorage

[![CI/CD Pipeline](https://github.com/YOUR_USERNAME/ColdStorage/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/ColdStorage/actions/workflows/ci.yml)

A comprehensive dashboard built with Next.js and Express.js for workforce management.

## Features
- 
- 

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS, Chart.js
- **Backend**: Express.js, Node.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone [your-repo-url]
   cd ColdStorage
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Fill in your Supabase credentials in .env
   ```

4. **Start the development servers**
   ```bash
   # Terminal 1 - Frontend
   npm run dev:all
   
   # Terminal 2 - Backend
   node server/index.js
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

## Testing

This project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npx playwright test        # E2E tests

# Run linter
npm run lint
```

See [README_TESTING.md](./README_TESTING.md) for detailed testing documentation.

## CI/CD Workflow

This project uses GitHub Actions for continuous integration:

### Branch Pushes
- ✅ **Lint checks only** - Quick feedback on code style

### Pull Requests & Main Branch
- ✅ **Full test suite** - Lint, Unit Tests, Integration Tests, E2E Tests, Build verification

For detailed workflow information, see [.github/workflows/README.md](.github/workflows/README.md).

**Note:** Replace `YOUR_USERNAME` in the CI badge above with your actual GitHub username.

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run tests locally: `npm test` and `npm run lint`
4. Create a Pull Request
5. Wait for CI checks to pass
6. Request code review

