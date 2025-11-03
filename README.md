# ColdStorage

[![CI/CD Pipeline](https://github.com/xingyinggg/ColdStorage/actions/workflows/ci.yml/badge.svg)](https://github.com/xingyinggg/ColdStorage/actions/workflows/ci.yml)

A comprehensive workforce management platform built with Next.js and Express.js, featuring task management, project tracking, team collaboration, and automated deadline notifications.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [API Routes](#api-routes)
- [CI/CD](#cicd)
- [License](#license)

## ✨ Features

### Core Functionality

1. **User Authentication & Authorization**

   Allows users to securely access the system using their login credentials. Depending on their role (e.g., staff, manager, director, HR), they will be granted access to different features and information. This ensures that data is protected and accessible only to the appropriate people.

   - Secure login using Supabase Auth with JWT tokens
   - Role-based access control (Staff, Manager, Director, HR)
   - Protected routes with middleware
   - Session management with SSR support

2. **Task Management**

   Users can create new tasks/subtasks (can be in a project or standalone), view their current tasks/subtasks, update task/subtask details, and update their statuses. Tasks can include deadlines, notes, invited collaborators, status tracking, and relevant documents. Managers and above can assign tasks/subtasks to their staff, transferring ownership to them. This forms the foundation for personal and team productivity.

   - Create, view, update, and delete tasks and subtasks
   - Can be standalone or part of a project
   - Task details: title, description, priority (1-10), status, due dates
   - Status tracking: To Do, Ongoing, In Review, Completed
   - Managers can assign tasks to staff (ownership transfer)
   - Invite collaborators to tasks
   - Add notes/comments to tasks
   - Attach up to 10 PDF files for reference

3. **Task Grouping and Organization (Projects)**

   Users can create projects to house their tasks and subtasks. Collaborators can be invited to work on projects. This ensures that there are proper organization and navigation for projects, as most staff work on multiple projects.

   - Create projects to organize related tasks
   - Invite collaborators to projects
   - Track project progress and completion
   - View all tasks within a project
   - Team member assignments

4. **Deadline and Schedule Tracking**

   Allows users to attach due dates to tasks and view schedules across a timeline. Automated reminders help staff stay on track, and overdue items are highlighted for follow-up. Team members within the same project can also view schedules to monitor team load and prioritization.

   - Attach due dates to tasks
   - Timeline view of all scheduled tasks
   - Calendar view for better visualization
   - Automated reminders for approaching deadlines
   - Overdue task highlighting
   - Team schedule visibility within projects

5. **Notification System (In-App)**

   The system sends alerts to notify users of approaching deadlines, new comments, task updates, or mentions from other team members. Notifications are shown in the app, helping users stay informed and responsive.

   - Real-time notifications for:
     - Approaching deadlines (1, 3, and 7 days prior)
     - New task assignments
     - Task updates and status changes
     - New comments/mentions
     - Overdue tasks
   - Mark notifications as read
   - Notification badges and alerts

6. **Report Generation and Exporting**

   Comprehensive reporting system with role-based views for different organizational levels. Each user role has access to specific report types tailored to their responsibilities and scope of oversight.

   **General Features:**
   - Generate and export reports in multiple formats
   - Real-time data visualization with charts
   - Customizable date ranges and filters
   - Team workload estimates and future planning insights

   **Manager Reports:**
   - Project schedule reports for assigned projects
   - Team member performance analytics
   - Department-specific task completion rates
   - Resource allocation and workload distribution
   - Task priority analysis and bottleneck identification

   **Director Reports:**
   - Organization-wide performance metrics
   - Cross-departmental collaboration analysis
   - Company KPIs and productivity scores
   - Project portfolio overview and completion rates
   - Strategic planning insights and trends

   **HR Reports:**
   - Employee performance rankings and scoring
   - Department productivity comparisons
   - Team effectiveness metrics
   - Workload distribution across the organization
   - Performance improvement recommendations

   **Project Team Reports:**
   - Project status overview (projected, completed, in-progress, under review tasks)
   - Individual and team contribution metrics
   - Deadline tracking and milestone progress
   - Task dependencies and critical path analysis

### Additional Features

- **Dashboard**: Personalized view with task overview, project summaries, upcoming deadlines
- **Team Collaboration**: Department and team organization, user profiles, project assignments
- **Profile Management**: Update user information, view assigned tasks and projects

### User Roles

- **HR**: Manage users, departments, teams, and organizational structure
- **Director**: Oversee all projects, departments, and high-level reporting
- **Manager**: Manage team projects, assign tasks, track team performance
- **Employee**: View assigned tasks, update task status, collaborate on projects

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 15.5.3 (React 19.1.0)
- **Styling**: Tailwind CSS 4
- **Charts**: Chart.js with react-chartjs-2

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js 5.1.0
- **Authentication**: Supabase Auth with JWT
- **File Upload**: Multer 2.0.2

### Database

- **Database**: Supabase (PostgreSQL)
- **ORM**: Supabase Client (@supabase/supabase-js)
- **Authentication**: Supabase Auth with SSR support

### Testing

- **Unit/Integration Tests**: Vitest 3.2.4
- **E2E Tests**: Playwright 1.56.1
- **Coverage**: @vitest/coverage-v8
- **API Testing**: Supertest 7.1.4
- **Component Testing**: React Testing Library 16.3.0

### Development Tools

- **Linting**: ESLint 9 with Next.js config
- **TypeScript**: TypeScript 5 for type safety
- **Process Management**: Concurrently for running multiple processes
- **Environment Variables**: dotenv

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Supabase Account**: You'll need access credentials - please contact the project maintainers

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/xingyinggg/ColdStorage.git
   cd ColdStorage
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Request Access**

   Before running the application, you need to obtain:

   - Environment variable file (`.env.local`)
   - Supabase project access credentials

   **📧 Contact the project maintainers to request:**

   - Your `.env.local` file with all necessary API keys
   - Access to the Supabase project dashboard
   - Test database credentials `.env.test` (if running tests)

4. **Set up environment variables**

   Once you receive your `.env.local` file from the maintainers, place it in the root directory of the project. If you are running tests, place the `.env.test` file in the tests folder.

## 🔐 Environment Variables

The project requires the following environment variables (provided by maintainers):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Application Configuration
NODE_ENV=development

# Test Configuration (optional, for running tests)
SUPABASE_TEST_URL=your_test_supabase_project_url
SUPABASE_TEST_SERVICE_KEY=your_test_supabase_service_role_key
SUPABASE_TEST_ANON_KEY=your_test_supabase_anon_key
```

### Environment Variable Details

| Variable                        | Description                                          | Required |
| ------------------------------- | ---------------------------------------------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL (client-side)              | Yes      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client-side)                 | Yes      |
| `SUPABASE_URL`                  | Your Supabase project URL (server-side)              | Yes      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key (server-side, full access) | Yes      |
| `SUPABASE_ANON_KEY`             | Supabase anonymous key (server-side)                 | Yes      |
| `SUPABASE_TEST_*`               | Test environment credentials (isolated database)     | No       |

> **⚠️ Security Warning**: Never commit your `.env.local` file to version control. Contact maintainers if you lose your credentials.

## 🏃 Running the Application

### Development Mode

**Option 1: Run both servers simultaneously (Recommended)**

```bash
npm run dev:all
```

This starts both the Next.js frontend (port 3000) and Express backend (port 4000) concurrently.

**Option 2: Run servers separately**

```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
npm run dev:server
```

### Production Mode

```bash
# Build the application
npm run build

# Start both servers
npm run start:all
```

Or run separately:

```bash
# Terminal 1 - Frontend
npm run start

# Terminal 2 - Backend
npm run start:server
```

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Supabase Dashboard**: Contact maintainers for access

## 🧪 Testing

This project has comprehensive test coverage with unit tests, integration tests, and end-to-end tests.

### Quick Start

```bash
# Run all tests (unit + integration)
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

### Test Suites

```bash
# Unit tests only (backend logic + UI components)
npm run test:unit

# Integration tests only (API endpoints)
npm run test:integration

# End-to-end tests (full user flows)
npx playwright test

# Run specific test files
npm run test:auth          # Auth integration tests
npm run test:tasks         # Tasks integration tests
npm run test:auth-unit     # Auth unit tests
npm run test:tasks-unit    # Tasks unit tests
```

### Coverage Reports

```bash
# Generate coverage for unit tests
npm run test:coverage:unit

# Generate coverage for integration tests
npm run test:coverage:integration

# View coverage reports
# Unit tests: open coverage-unit/index.html
# Integration tests: open coverage-integration/index.html
```

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── ui/                  # React component tests (JSX)
│   └── *.test.{js,ts}       # Backend logic tests
├── integration/             # Integration tests
│   ├── setupTests.js        # Test database setup
│   └── *.test.js            # API endpoint tests
├── e2e/                     # End-to-end tests (Playwright)
│   ├── simple-navigation.spec.js
│   ├── tasks-create.spec.js
│   ├── tasks-edit.spec.js
│   └── tasks-overdue.spec.js
└── setup/                   # Test utilities
    ├── manualSetup.js       # Manual database setup
    ├── seedOnly.js          # Seed test data
    └── testConnection.js    # Test database connection
```

### Running Playwright Tests

```bash
# Run all E2E tests
npx playwright test

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/simple-navigation.spec.js

# Debug mode
npx playwright test --debug

# View test report
npx playwright show-report
```

For more detailed testing information, see [README_TESTING.md](./README_TESTING.md).

## 📁 Project Structure

```
ColdStorage/
├── src/                          # Frontend source code
│   ├── app/                      # Next.js App Router pages
│   │   ├── dashboard/           # Main dashboard
│   │   ├── login/               # Login page
│   │   ├── register/            # Registration page
│   │   ├── profile/             # User profile
│   │   ├── projects/            # Projects management
│   │   ├── schedule/            # Calendar/schedule view
│   │   ├── notifications/       # Notifications page
│   │   ├── report/              # Reporting dashboard
│   │   ├── layout.tsx           # Root layout
│   │   └── page.js              # Home page (redirects to login/dashboard)
│   ├── components/              # Reusable React components
│   │   ├── tasks/               # Task-related components
│   │   ├── ui/                  # UI components
│   │   └── ...
│   ├── contexts/                # React Context providers
│   ├── utils/                   # Utility functions
│   │   └── supabase/            # Supabase client utilities
│   └── constants/               # Constants and config
│
├── server/                       # Backend Express server
│   ├── index.js                 # Server entry point
│   ├── routes/                  # API route handlers
│   │   ├── auth.js              # Authentication endpoints
│   │   ├── tasks.js             # Task CRUD operations
│   │   ├── projects.js          # Project management
│   │   ├── users.js             # User management
│   │   ├── notification.js      # Notifications
│   │   ├── report.js            # Reporting endpoints
│   │   ├── hr.js                # HR-specific operations
│   │   ├── director.js          # Director-specific operations
│   │   ├── manager-projects.js  # Manager project operations
│   │   └── department_teams.js  # Department/team management
│   ├── services/                # Business logic services
│   │   └── deadlineNotificationService.js
│   ├── lib/                     # Server utilities
│   │   └── supabase.js          # Supabase server client
│   ├── schemas/                 # Zod validation schemas
│   └── migrations/              # Database migrations
│
├── tests/                        # Test files
│   ├── unit/                    # Unit tests
│   │   └── ui/                  # React component tests (JSX)
│   ├── integration/             # Integration tests
│   ├── e2e/                     # End-to-end tests
│   ├── setup/                   # Test setup utilities
│   ├── setupTests.ts            # Unit test setup
│   └── setupUI.ts               # UI test setup
│
├── public/                       # Static assets
├── database_migrations/          # SQL migration files
├── coverage-unit/               # Unit test coverage reports
├── coverage-integration/        # Integration test coverage reports
├── playwright-report/           # Playwright test reports
├── test-results/                # Playwright test results
│
├── middleware.js                # Next.js middleware (auth, redirects)
├── next.config.ts               # Next.js configuration
├── vitest.config.js             # Vitest test configuration
├── playwright.config.js         # Playwright E2E test config
├── eslint.config.mjs            # ESLint configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## 🔌 API Routes

The backend server exposes the following API endpoints:

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

### Tasks

- `GET /api/tasks` - Get all tasks (filtered by user role)
- `GET /api/tasks/:id` - Get specific task
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/user/:userId` - Get tasks for specific user

### Subtasks

- `GET /api/subtasks/:taskId` - Get subtasks for a task
- `POST /api/subtasks` - Create subtask
- `PUT /api/subtasks/:id` - Update subtask
- `DELETE /api/subtasks/:id` - Delete subtask

### Projects

- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get specific project
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/manager-projects` - Get manager's projects

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get specific user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Notifications

- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark notification as read
- `DELETE /api/notifications/:id` - Delete notification

### Reports

- `GET /api/reports/tasks` - Get task reports
- `GET /api/reports/projects` - Get project reports
- `GET /api/reports/users` - Get user performance reports

### HR & Admin

- `GET /api/hr/departments` - Get all departments
- `POST /api/hr/departments` - Create department
- `GET /api/hr/teams` - Get all teams
- `POST /api/hr/teams` - Create team
- `GET /api/director/overview` - Get director overview

### Department & Teams

- `GET /api/department-teams` - Get department and team structure
- `POST /api/department-teams` - Update department/team assignments

All API endpoints require authentication via JWT token in the `Authorization` header (except register/login).

## 🔄 CI/CD

This project uses GitHub Actions for continuous integration and automated testing with real-time Telegram notifications.

### 📱 Telegram Notifications

The CI/CD pipeline sends automated notifications to a Telegram group chat for every push and pull request:

- **✅ Success Notifications**: When all tests pass and build succeeds
- **❌ Failure Notifications**: When tests fail or build errors occur
- **📊 Detailed Reports**: Including commit information, branch name, and test results
- **🔗 Quick Links**: Direct links to GitHub Actions logs for debugging

This ensures the team stays informed about code quality and build status in real-time.

### Workflow Triggers

#### Branch Pushes (Quick Feedback)

- ✅ **Lint checks only** - Fast code style validation
- Runs ESLint on all changed files
- Telegram notification on success/failure

#### Pull Requests & Main Branch (Full Pipeline)

- ✅ **Comprehensive testing** including:
  - ESLint code quality checks
  - Unit tests (backend logic + UI components)
  - Integration tests (API endpoints)
  - End-to-end tests (Playwright)
  - Build verification
  - Coverage reports
- Telegram notification with detailed test results

### Test Coverage Thresholds

- **Unit Tests**: 40% lines, 50% branches
- **Integration Tests**: 50% lines, 50% branches

### Workflow Configuration

The CI pipeline is configured in `.github/workflows/ci.yml` and includes:

- Automated test execution on multiple Node.js versions
- Parallel test runs for faster feedback
- Coverage report generation and archiving
- Telegram bot integration for CI pipeline
- Automatic deployment on main branch success

## 📄 License

This project is owned by **IS212 G1T3 Cold Storage**

**Current Version**: 0.1.0  
**Last Updated**: November 2025  
**Repository**: https://github.com/xingyinggg/ColdStorage

---

**Maintainers**: IS212 G1T3 Cold Storage Team
