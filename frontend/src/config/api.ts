/**
 * API Configuration
 *
 * Set REACT_APP_API_BASE_URL in your environment:
 * - Local: defaults to http://localhost:8000
 * - Netlify: set in Site settings → Environment variables
 */
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
