# Testing Guide

This document explains how to set up and run tests for the ColdStorage project.

## Quick Start

### 1. Install Test Dependencies

```bash
npm install --save-dev vitest @vitest/coverage-v8 supertest
```

### 2. Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage