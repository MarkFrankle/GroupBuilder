import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
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
      'Reading Your Assignments',
      'Running Your Sessions',
      'How Good Are the Assignments: Reading the Banner',
      'Changing Assignments',
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
      'Reading Your Assignments',
      'Running Your Sessions',
      'How Good Are the Assignments: Reading the Banner',
      'Changing Assignments',
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
    // Info callout explaining the login-link expiry
    expect(screen.getAllByText(/login links expire/).length).toBeGreaterThan(0);
  });

  // In-app navigation to /help#section doesn't scroll on its own: the browser
  // only jumps to a hash on a full page load.
  test('opening with a section in the address scrolls to that heading', () => {
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = jest.fn(function (this: Element) {
      scrolled.push(this);
    });
    render(
      <MemoryRouter initialEntries={['/help#running-your-sessions']}>
        <HelpPage />
      </MemoryRouter>,
    );
    expect(scrolled).toContain(screen.getByRole('heading', { name: 'Running Your Sessions' }));
  });
});
