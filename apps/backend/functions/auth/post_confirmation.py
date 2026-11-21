"""Cognito PostConfirmation trigger: inserts the users row on a user's first sign-in."""
import re

import psycopg2
from psycopg2.extensions import cursor

from utils import get_db_connection

# Raised messages reach the user via the callback URL; details stay in CloudWatch.
GENERIC_FAILURE = 'Account setup failed. Please try signing in again later.'


def derive_base_display_name(email: str) -> str:
    """Email local part, lowercased, trailing digits stripped.

    Input: "AllyGoodman2021@northwestern.edu". Output: "allygoodman".
    """
    local_part = email.split('@')[0].lower()
    return re.sub(r'\d+$', '', local_part) or local_part


def pick_unique_display_name(cur: cursor, base: str) -> str:
    """Returns base if unused, else base + the smallest free suffix >= 2.

    Input: open cursor, base name. Output: "allygoodman", "allygoodman2", ...
    Concurrent sign-ups can pick the same name; UNIQUE(display_name) rejects the second.
    """
    like_pattern = base.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
    cur.execute("SELECT display_name FROM users WHERE display_name LIKE %s", (like_pattern,))
    taken = {row[0] for row in cur.fetchall()}
    if base not in taken:
        return base
    suffix = 2
    while f'{base}{suffix}' in taken:
        suffix += 1
    return f'{base}{suffix}'


def derive_full_name(attributes: dict[str, str]) -> str | None:
    """Full name from Google claims: `name`, else `given_name family_name`.

    Input: Cognito userAttributes. Output: the name, or None if absent.
    """
    name = attributes.get('name', '').strip()
    if name:
        return name
    joined = ' '.join(
        part for part in (attributes.get('given_name', '').strip(), attributes.get('family_name', '').strip()) if part
    )
    return joined or None


def lambda_handler(event: dict, context: object) -> dict:
    """Inserts the users row for PostConfirmation_ConfirmSignUp events.

    Input: Cognito trigger event. Output: the same event. Raises GENERIC_FAILURE on any error.
    """
    if event.get('triggerSource') != 'PostConfirmation_ConfirmSignUp':
        return event

    attributes = event['request']['userAttributes']
    # Keys only; values are PII.
    print(f"PostConfirmation attribute keys: {sorted(attributes.keys())}")

    sub = attributes.get('sub')
    email = attributes.get('email')
    if not sub or not email:
        print("PostConfirmation event missing 'sub' and/or 'email'")
        raise Exception(GENERIC_FAILURE)

    conn = None
    try:
        conn = get_db_connection()
        with conn:
            with conn.cursor() as cur:
                display_name = pick_unique_display_name(cur, derive_base_display_name(email))
                # ON CONFLICT makes Cognito's retries idempotent.
                cur.execute(
                    """
                    INSERT INTO users (cognito_sub, email, display_name, full_name)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (cognito_sub) DO NOTHING
                    """,
                    (sub, email.lower(), display_name, derive_full_name(attributes)),
                )
    except psycopg2.errors.UniqueViolation as e:
        # display_name race or email re-registered under a new sub.
        print(f"Provisioning unique violation for sub={sub}: constraint={e.diag.constraint_name}")
        raise Exception(GENERIC_FAILURE) from e
    except psycopg2.Error as e:
        # pgcode only: Postgres messages can include the failing row (emails, names).
        print(f"Provisioning DB error for sub={sub}: {type(e).__name__} pgcode={e.pgcode}")
        raise Exception(GENERIC_FAILURE) from e
    except Exception as e:
        print(f"Provisioning failed for sub={sub}: {type(e).__name__}")
        raise Exception(GENERIC_FAILURE) from e
    finally:
        if conn is not None:
            conn.close()

    return event
