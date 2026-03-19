import '@testing-library/jest-dom'

// ResizeObserver is not available in jsdom; mock it for Radix UI components that use it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
