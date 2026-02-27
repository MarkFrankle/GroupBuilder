"""Email service using Resend for transactional emails."""
import logging
import os
from pathlib import Path
from typing import Optional

import resend
from firebase_admin import auth as firebase_auth
from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

# Template directory
TEMPLATE_DIR = Path(__file__).parent.parent / "templates"

# Initialize Jinja2 environment for templates
_jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=True)


class EmailService:
    """Service for sending transactional emails via Resend."""

    def __init__(self):
        """Initialize with Resend API key from environment."""
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@groupbuilder.app")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

        if not self.api_key:
            logger.warning("RESEND_API_KEY not set - emails will be skipped")
        else:
            resend.api_key = self.api_key

    def _send_email(
        self, to_email: str, subject: str, html_content: str, plain_content: str
    ) -> bool:
        """Send an email via Resend.

        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_content: HTML version of email body
            plain_content: Plain text version of email body

        Returns:
            True if sent successfully, False otherwise
        """
        if not self.api_key:
            logger.info(f"[DRY RUN] Would send email to {to_email}: {subject}")
            return False

        try:
            params = {
                "from": f"GroupBuilder <{self.from_email}>",
                "to": [to_email],
                "subject": subject,
                "html": html_content,
                "text": plain_content,
            }

            response = resend.Emails.send(params)

            if response and response.id:
                logger.info(f"Email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Email delivery failed to {to_email}: {response}")
                return False

        except Exception as e:
            logger.exception(f"Exception sending email to {to_email}: {e}")
            return False

    def _render_template(self, template_name: str, **context) -> str:
        """Render a Jinja2 template with context.

        Args:
            template_name: Name of template file
            **context: Template variables

        Returns:
            Rendered template string
        """
        template = _jinja_env.get_template(template_name)
        return template.render(**context)

    def send_facilitator_invite(
        self,
        to_email: str,
        org_name: str,
        invite_token: str,
        inviter_email: Optional[str] = None,
    ) -> bool:
        """Send facilitator invite email.

        Args:
            to_email: Recipient email address
            org_name: Name of the program
            invite_token: Unique invite token
            inviter_email: Email of person who sent invite (optional)

        Returns:
            True if sent successfully
        """
        # Generate a Firebase magic sign-in link that redirects to the invite page.
        # When the facilitator clicks this link, they're authenticated automatically.
        continue_url = f"{self.frontend_url}/invite/{invite_token}"
        try:
            action_code_settings = firebase_auth.ActionCodeSettings(
                url=continue_url,
                handle_code_in_app=True,
            )
            invite_link = firebase_auth.generate_sign_in_with_email_link(
                to_email, action_code_settings
            )
        except Exception as e:
            logger.warning(
                f"Failed to generate magic sign-in link for {to_email}, "
                f"falling back to plain invite link: {e}"
            )
            invite_link = continue_url

        html_content = self._render_template(
            "facilitator_invite_email.html",
            org_name=org_name,
            invite_link=invite_link,
            inviter_email=inviter_email,
        )

        plain_content = self._render_template(
            "facilitator_invite_email.txt",
            org_name=org_name,
            invite_link=invite_link,
            inviter_email=inviter_email,
        )

        subject = f"You're invited to facilitate {org_name} on GroupBuilder"

        return self._send_email(to_email, subject, html_content, plain_content)


# Singleton instance for convenience
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create singleton email service instance."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
