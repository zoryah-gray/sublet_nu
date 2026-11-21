"""Tier 1: PostConfirmation handler against the local Docker Postgres (never AWS).

Needs DATABASE_URL pointing at a migrated database, same as the jest DB tests.
get_db_connection is swapped for a plain psycopg2 connection, so the IAM-token
path is NOT covered here (Tier 2 covers it). Rows use an
@test.subletnu.invalid email and are deleted before and after each test.
"""
import os
import uuid

import psycopg2
import pytest

import post_confirmation

TEST_EMAIL_DOMAIN = 'test.subletnu.invalid'


@pytest.fixture
def db_url() -> str:
    """Returns DATABASE_URL. Fails loudly instead of skipping, like test/db/*.test.ts."""
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise RuntimeError('DATABASE_URL is not set — provisioning tests need a migrated local Postgres.')
    return url


@pytest.fixture
def local_db(monkeypatch: pytest.MonkeyPatch, db_url: str):
    """Points the handler at local Postgres and cleans up test rows. Yields a verification connection."""
    monkeypatch.setattr(post_confirmation, 'get_db_connection', lambda: psycopg2.connect(db_url))
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    delete_sql = 'DELETE FROM users WHERE email LIKE %s'
    with conn.cursor() as cur:
        cur.execute(delete_sql, (f'%@{TEST_EMAIL_DOMAIN}',))
    yield conn
    with conn.cursor() as cur:
        cur.execute(delete_sql, (f'%@{TEST_EMAIL_DOMAIN}',))
    conn.close()


def postconfirmation_event(attributes: dict[str, str]) -> dict:
    """Builds a minimal PostConfirmation event. Input: userAttributes. Output: event dict."""
    return {
        'triggerSource': 'PostConfirmation_ConfirmSignUp',
        'request': {'userAttributes': attributes},
        'response': {},
    }


def rows_for_sub(conn, sub: str) -> list[tuple]:
    """Returns (cognito_sub, email) rows for a sub. Input: connection, sub. Output: list of rows."""
    with conn.cursor() as cur:
        cur.execute('SELECT cognito_sub::text, email FROM users WHERE cognito_sub = %s', (sub,))
        return cur.fetchall()


def test_inserts_row_with_sub_and_email(local_db) -> None:
    sub = str(uuid.uuid4())
    email = f'Provision.Test@{TEST_EMAIL_DOMAIN}'
    post_confirmation.lambda_handler(postconfirmation_event({'sub': sub, 'email': email}), None)
    assert rows_for_sub(local_db, sub) == [(sub, email.lower())]


def test_second_call_with_same_sub_is_idempotent(local_db) -> None:
    sub = str(uuid.uuid4())
    event = postconfirmation_event({'sub': sub, 'email': f'idempotent@{TEST_EMAIL_DOMAIN}'})
    post_confirmation.lambda_handler(event, None)
    post_confirmation.lambda_handler(event, None)  # Cognito retry: must not raise
    assert len(rows_for_sub(local_db, sub)) == 1


@pytest.mark.parametrize('attributes', [
    {'email': f'nosub@{TEST_EMAIL_DOMAIN}'},
    {'sub': str(uuid.uuid4())},
    {'sub': '', 'email': f'emptysub@{TEST_EMAIL_DOMAIN}'},
    {'sub': str(uuid.uuid4()), 'email': ''},
])
def test_missing_sub_or_email_raises_before_db(monkeypatch: pytest.MonkeyPatch, attributes: dict) -> None:
    calls = []
    monkeypatch.setattr(post_confirmation, 'get_db_connection', lambda: calls.append(1))
    with pytest.raises(Exception) as excinfo:
        post_confirmation.lambda_handler(postconfirmation_event(attributes), None)
    assert str(excinfo.value) == post_confirmation.GENERIC_FAILURE
    assert calls == []
