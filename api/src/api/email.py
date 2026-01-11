"""
Email utility for sending magic links via SendGrid.

DEPRECATED: This module is no longer used as of 2026-01-11.
Email functionality has been replaced with a copy link workflow.
Keeping this file for historical reference only.

DO NOT USE IN NEW CODE.

Falls back to logging if SendGrid is not configured.
"""

import logging
import os
import re
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

# Email validation regex
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def _mask_email(email: str) -> str:
    """Mask email address for logging (GDPR compliance)."""
    if not email or '@' not in email:
        return "invalid@email"
    local, domain = email.rsplit('@', 1)
    if len(local) <= 2:
        masked_local = local[0] + '*'
    else:
        masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


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

    Raises:
        ValueError: If email address format is invalid
    """
    # Validate email format
    if not to_email or not EMAIL_REGEX.match(to_email):
        logger.error(f"Invalid email address format: {_mask_email(to_email)}")
        raise ValueError(f"Invalid email address format")

    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("FROM_EMAIL", "noreply@groupbuilder.app")

    if base_url is None:
        base_url = os.getenv("FRONTEND_URL")
        if not base_url:
            logger.error("FRONTEND_URL environment variable is not set")
            raise ValueError(
                "FRONTEND_URL environment variable must be set. "
                "Set it to your frontend URL (e.g., http://localhost:3000 for development, "
                "https://group-builder.netlify.app for production)"
            )

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
            f"Email would be sent to {_mask_email(to_email)}:\n"
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
            logger.info(f"Successfully sent magic link email to {_mask_email(to_email)}")
            return True
        else:
            logger.error(f"SendGrid returned status {response.status_code} for {_mask_email(to_email)}")
            return False

    except Exception as e:
        logger.error(f"Failed to send email to {_mask_email(to_email)}: {str(e)}", exc_info=True)
        return False
