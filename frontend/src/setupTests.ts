// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock the API client to bypass Firebase authentication in tests.
// We mock at the utility level rather than firebase.ts because:
// 1. apiClient.ts and fetchWithRetry.ts use relative imports ('../services/firebase')
// 2. Jest path resolution doesn't match the @/ alias for relative imports
// 3. Mocking at the utility level is simpler and more reliable
jest.mock('@/utils/apiClient', () => ({
  authenticatedFetch: jest.fn((url: string, options?: RequestInit) => {
    // Return a mock Response that tests can customize via mockImplementation
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      headers: new Headers(),
      status: 200,
    });
  }),
  apiRequest: jest.fn(() => Promise.resolve({})),
}));

// Mock fetchWithRetry utility - also uses Firebase auth via relative import
jest.mock('@/utils/fetchWithRetry', () => ({
  fetchWithRetry: jest.fn((url: string, options?: RequestInit) => {
    // Return a mock Response that tests can customize via mockImplementation
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      headers: new Headers(),
      status: 200,
    });
  }),
}));

// Mock Firebase service for components that use auth state directly
jest.mock('@/services/firebase', () => ({
  getCurrentUserToken: jest.fn(() => Promise.resolve('mock-firebase-token')),
  sendMagicLink: jest.fn(() => Promise.resolve()),
  completeMagicLinkSignIn: jest.fn(() => Promise.resolve({ uid: 'test-user-id', email: 'test@example.com' })),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthChange: jest.fn((callback) => {
    // Immediately call with mock user
    callback({ uid: 'test-user-id', email: 'test@example.com' });
    return jest.fn(); // Return unsubscribe function
  }),
  auth: {
    currentUser: {
      uid: 'test-user-id',
      email: 'test@example.com',
      getIdToken: jest.fn(() => Promise.resolve('mock-firebase-token')),
    },
  },
}));
