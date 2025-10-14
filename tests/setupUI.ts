import '@testing-library/jest-dom/vitest';
// For UI tests, no Next.js router is expected, but keep a safe mock
import { vi } from 'vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));

// Ensure DOM is cleaned between tests to avoid duplicate elements
afterEach(() => {
  cleanup();
});


