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
      'Welcome to Group Builder',
      'Creating Your Roster',
      'Viewing Your Assignments',
      'Printing & Sharing',
      'Changing a Session',
      'Troubleshooting',
    ];
    for (const name of sectionNames) {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  test('renders all section headings', () => {
    renderPage();
    const headings = [
      'Welcome to Group Builder',
      'Creating Your Roster',
      'Viewing Your Assignments',
      'Printing & Sharing',
      'Changing a Session',
      'Troubleshooting',
    ];
    for (const heading of headings) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  test('renders screenshots with captions', () => {
    renderPage();
    expect(screen.getByAltText(/roster manager/i)).toBeInTheDocument();
  });

  test('renders callout boxes', () => {
    renderPage();
    // Info callout explaining that completion runs in order
    expect(screen.getAllByText(/only complete the next session/).length).toBeGreaterThan(0);
  });
});
