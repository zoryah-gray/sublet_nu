"""Cognito PreSignUp trigger: only verified Google emails on the environment's domain may sign up."""
import os

# prod: northwestern.edu and any subdomain (u., alum., ...). dev: gmail.com only.
ALLOWED_DOMAINS = {
    'prod': {'domain': 'northwestern.edu', 'subdomains': True},
    'dev': {'domain': 'gmail.com', 'subdomains': False},
}


def is_allowed_domain(environment: str | None, email: str) -> bool:
    """Checks an email's domain against the environment's rule. Fails closed.

    Input: ENVIRONMENT value, email. Output: True if allowed, False if not.
    Raises if the environment is missing or unknown (no dev default).
    """
    if environment not in ALLOWED_DOMAINS:
        print(f"Rejecting sign-up: invalid ENVIRONMENT value {environment!r}")
        raise Exception('Sign-up is temporarily unavailable.')
    rule = ALLOWED_DOMAINS[environment]
    domain = email.lower().rsplit('@', 1)[-1] if '@' in email else ''
    if domain == rule['domain']:
        return True
    return rule['subdomains'] and domain.endswith('.' + rule['domain'])


def lambda_handler(event: dict, context: object) -> dict:
    """Allows only Google sign-ups with a verified, allowed-domain email.

    Input: Cognito trigger event. 
    Output: the same event. Raises to reject.
    """
    environment = os.environ.get('ENVIRONMENT')
    attributes = event.get('request', {}).get('userAttributes', {})
    email = attributes.get('email') or ''
    # Environment is checked first so a bad ENVIRONMENT rejects every path.
    allowed = is_allowed_domain(environment, email)

    if event.get('triggerSource') != 'PreSignUp_ExternalProvider':
        print(f"Rejecting sign-up: unsupported triggerSource {event.get('triggerSource')!r}")
        raise Exception('Please sign in with Google.')

    if attributes.get('email_verified') != 'true':
        # Keys only; values are PII.
        print(f"Rejecting sign-up: email_verified={attributes.get('email_verified')!r}; keys={sorted(attributes.keys())}")
        raise Exception('Your Google account email is not verified.')

    if not allowed:
        print(f"Rejecting sign-up: domain {email.rsplit('@', 1)[-1].lower()!r} not allowed")
        raise Exception('Please sign in with your Northwestern Google account.' if environment == 'prod'
                        else 'Please sign in with a Gmail account.')

    return event
