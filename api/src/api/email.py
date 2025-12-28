"""
Email utility for sending magic links via SendGrid.
Falls back to logging if SendGrid is not configured.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import SendGrid, but gracefully fall back if not available
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    logger.warning("SendGrid library not installed. Email sending will be logged only.")


def send_magic_link_email(
    to_email: str,
    magic_link_path: str,
    num_sessions: int,
    num_tables: int,
    base_url: Optional[str] = None
) -> bool:
    """
    Send a magic link email to the user with their assignment results.

    Args:
        to_email: Recipient email address
        magic_link_path: Path to results (e.g., "/results/abc-123")
        num_sessions: Number of sessions generated
        num_tables: Number of tables per session
        base_url: Base URL for the frontend (defaults to env var or placeholder)

    Returns:
        True if email was sent successfully, False otherwise
    """
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("FROM_EMAIL", "noreply@groupbuilder.app")

    if base_url is None:
        base_url = os.getenv("FRONTEND_URL", "https://group-builder.netlify.app")

    full_magic_link = f"{base_url}{magic_link_path}"

    # Email content
    subject = "Your Group Assignments are Ready!"

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Your Table Assignments are Ready</h2>

          <p>We've generated optimized table assignments for your event:</p>

          <ul style="background: #f3f4f6; padding: 15px 30px; border-radius: 8px;">
            <li><strong>{num_sessions}</strong> sessions</li>
            <li><strong>{num_tables}</strong> tables per session</li>
            <li>Balanced diversity across all tables</li>
            <li>Couples seated separately</li>
          </ul>

          <p style="margin: 30px 0;">
            <a href="{full_magic_link}"
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Your Assignments
            </a>
          </p>

          <p style="color: #6b7280; font-size: 14px;">
            This link is valid for 30 days. You can bookmark it for future reference.
          </p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="{full_magic_link}" style="color: #2563eb;">{full_magic_link}</a>
          </p>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            Made with care for communities building bridges through dialogue.
          </p>
        </div>
      </body>
    </html>
    """

    plain_text_content = f"""
Your Table Assignments are Ready!

We've generated optimized table assignments for your event:
- {num_sessions} sessions
- {num_tables} tables per session
- Balanced diversity across all tables
- Couples seated separately

View your assignments here:
{full_magic_link}

This link is valid for 30 days.

---
Made with care for communities building bridges through dialogue.
    """

    # If SendGrid is not configured, just log
    if not sendgrid_api_key or not SENDGRID_AVAILABLE:
        logger.info(
            f"Email would be sent to {to_email}:\n"
            f"Subject: {subject}\n"
            f"Magic Link: {full_magic_link}\n"
            f"(Set SENDGRID_API_KEY to enable actual email sending)"
        )
        return False

    try:
        message = Mail(
            from_email=Email(from_email),
            to_emails=To(to_email),
            subject=subject,
            plain_text_content=Content("text/plain", plain_text_content),
            html_content=Content("text/html", html_content)
        )

        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)

        if response.status_code >= 200 and response.status_code < 300:
            logger.info(f"Successfully sent magic link email to {to_email}")
            return True
        else:
            logger.error(f"SendGrid returned status {response.status_code} for {to_email}")
            return False

    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}", exc_info=True)
        return False
