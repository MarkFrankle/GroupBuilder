import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import HelpPage from '../HelpPage';

const renderPage = () => render(<BrowserRouter><HelpPage /></BrowserRouter>);

describe('HelpPage', () => {
  test('renders page title', () => {
    renderPage();
    expect(screen.getByText('Group Builder Help')).toBeInTheDocument();
  });

  test('renders table of contents with all section links', () => {
    renderPage();
    const sectionNames = [
      'Getting Started',
      'Creating Your Roster',
      'Generating Groups',
      'Viewing Your Groups',
      'Printing & Sharing',
      'Editing Sessions',
      'Troubleshooting',
    ];
    for (const name of sectionNames) {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  test('renders all section headings', () => {
    renderPage();
    const headings = [
      'Getting Started',
      'Creating Your Roster',
      'Generating Groups',
      'Viewing Your Groups',
      'Printing & Sharing',
      'Editing Sessions',
      'Troubleshooting',
    ];
    for (const heading of headings) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  test('renders screenshots with captions', () => {
    renderPage();
    expect(screen.getByAltText(/roster manager/i)).toBeInTheDocument();
    expect(screen.getByAltText(/edit mode/i)).toBeInTheDocument();
  });

  test('renders callout boxes', () => {
    renderPage();
    // Tip callout in quality section
    expect(screen.getByText(/slower speed setting/)).toBeInTheDocument();
    // Warning callout in generating section
    expect(screen.getAllByText(/Need at least N facilitators/).length).toBeGreaterThan(0);
  });
});
