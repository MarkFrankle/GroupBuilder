"""
Email utility for sending magic links via SendGrid.
Falls back to logging if SendGrid is not configured.
"""

import logging
import os
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

# Try to import SendGrid, but gracefully fall back if not available
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    logger.warning("SendGrid library not installed. Email sending will be logged only.")

# Set up Jinja2 environment for email templates
TEMPLATES_DIR = Path(__file__).parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)


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

    # Template context
    context = {
        "magic_link": full_magic_link,
        "num_sessions": num_sessions,
        "num_tables": num_tables
    }

    # Render templates
    html_template = jinja_env.get_template("magic_link_email.html")
    text_template = jinja_env.get_template("magic_link_email.txt")

    html_content = html_template.render(context)
    plain_text_content = text_template.render(context)

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
