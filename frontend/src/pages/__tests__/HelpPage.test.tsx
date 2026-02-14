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
    const sectionIds = [
      'getting-started',
      'creating-your-roster',
      'generating-groups',
      'viewing-your-groups',
      'printing-and-sharing',
      'editing-sessions',
      'troubleshooting',
    ];
    for (const id of sectionIds) {
      const anchor = document.querySelector(`a[href="#${id}"]`);
      expect(anchor).toBeInTheDocument();
    }
  });

  test('renders all section headings with correct IDs', () => {
    renderPage();
    const sectionIds = [
      'getting-started',
      'creating-your-roster',
      'generating-groups',
      'viewing-your-groups',
      'printing-and-sharing',
      'editing-sessions',
      'troubleshooting',
    ];
    for (const id of sectionIds) {
      const element = document.getElementById(id);
      expect(element).toBeInTheDocument();
    }
  });

  test('renders screenshot placeholders', () => {
    renderPage();
    expect(screen.getByText(/Screenshot A/)).toBeInTheDocument();
    expect(screen.getByText(/Screenshot K/)).toBeInTheDocument();
  });

  test('renders callout boxes', () => {
    renderPage();
    // Tip callout in quality section
    expect(screen.getByText(/slower speed setting/)).toBeInTheDocument();
    // Warning callout in generating section
    expect(screen.getAllByText(/Need at least N facilitators/).length).toBeGreaterThan(0);
  });
});
