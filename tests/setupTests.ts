import '@testing-library/jest-dom/vitest';

// Silence Next.js router warnings if any components import it
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));


