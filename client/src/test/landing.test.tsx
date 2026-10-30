import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../app/page';

describe('Landing Page Smoke Test', () => {
  it('renders the main heading and primary action elements', () => {
    render(<HomePage />);

    // Verify main platform heading
    const mainHeading = screen.getByRole('heading', {
      level: 1,
      name: /Verified Alumni Mentorship & Career Guidance/i,
    });
    expect(mainHeading).toBeInTheDocument();

    // Verify call to action buttons exist
    const studentCta = screen.getByRole('link', { name: /Join as a Student/i });
    expect(studentCta).toBeInTheDocument();
    expect(studentCta).toHaveAttribute('href', '/register?role=student');

    const alumniCta = screen.getByRole('link', { name: /Register as an Alumni Mentor/i });
    expect(alumniCta).toBeInTheDocument();
    expect(alumniCta).toHaveAttribute('href', '/register?role=alumni');

    // Verify section headers for core workflow and benefits
    expect(
      screen.getByRole('heading', { name: /How the Mentorship Process Operates/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Engineered for the Entire Academic Community/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Rigorous Verification. Zero Counterfeit Profiles./i })
    ).toBeInTheDocument();
  });
});
