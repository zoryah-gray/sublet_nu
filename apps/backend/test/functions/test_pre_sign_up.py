"""Tier 1 (pure unit): PreSignUp domain gate. No AWS, no network.

Rejection must be a raised exception (Cognito blocks sign-up only when the
trigger raises), so every negative case asserts the handler throws.
"""
import pytest

import pre_sign_up as trigger


def presignup_event(email: str, source: str = 'PreSignUp_ExternalProvider', verified: str = 'true') -> dict:
    """Builds a minimal PreSignUp event. Input: email and overrides. Output: event dict."""
    return {
        'triggerSource': source,
        'request': {'userAttributes': {'email': email, 'email_verified': verified}},
        'response': {},
    }


@pytest.mark.parametrize('email', [
    'ag2021@northwestern.edu',
    'ag2021@u.northwestern.edu',
    'ag2021@alum.northwestern.edu',
    'AG2021@U.Northwestern.EDU',
])
def test_prod_allows_northwestern_domains(monkeypatch: pytest.MonkeyPatch, email: str) -> None:
    monkeypatch.setenv('ENVIRONMENT', 'prod')
    event = presignup_event(email)
    assert trigger.lambda_handler(event, None) is event


@pytest.mark.parametrize('email', [
    'ag@gmail.com',
    'ag@evilnorthwestern.edu',         # suffix match without the dot
    'ag@northwestern.edu.evil.com',    # NU domain as a prefix
    'ag@northwestern.com',
    'ag@u-northwestern.edu',
    'ag@northwestern.edu@evil.com',
    'not-an-email',
    '',
])
def test_prod_rejects_other_domains(monkeypatch: pytest.MonkeyPatch, email: str) -> None:
    monkeypatch.setenv('ENVIRONMENT', 'prod')
    with pytest.raises(Exception) as excinfo:
        trigger.lambda_handler(presignup_event(email), None)
    if email:
        assert email not in str(excinfo.value)  # never echo raw input


def test_dev_allows_gmail(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('ENVIRONMENT', 'dev')
    event = presignup_event('tester@gmail.com')
    assert trigger.lambda_handler(event, None) is event


@pytest.mark.parametrize('email', [
    'ag@northwestern.edu',
    'ag@u.northwestern.edu',
    'ag@googlemail.com',
    'ag@mail.gmail.com',
    'ag@gmail.com.evil.com',
])
def test_dev_rejects_everything_else(monkeypatch: pytest.MonkeyPatch, email: str) -> None:
    monkeypatch.setenv('ENVIRONMENT', 'dev')
    with pytest.raises(Exception):
        trigger.lambda_handler(presignup_event(email), None)


@pytest.mark.parametrize('environment', [None, '', 'staging', 'PROD', 'production', ' prod'])
@pytest.mark.parametrize('email', ['ag@northwestern.edu', 'ag@gmail.com'])
def test_unset_or_unknown_environment_fails_closed(
    monkeypatch: pytest.MonkeyPatch, environment: str | None, email: str
) -> None:
    if environment is None:
        monkeypatch.delenv('ENVIRONMENT', raising=False)
    else:
        monkeypatch.setenv('ENVIRONMENT', environment)
    with pytest.raises(Exception):
        trigger.lambda_handler(presignup_event(email), None)


@pytest.mark.parametrize('source', ['PreSignUp_SignUp', 'PreSignUp_AdminCreateUser'])
def test_non_google_signup_rejected(monkeypatch: pytest.MonkeyPatch, source: str) -> None:
    monkeypatch.setenv('ENVIRONMENT', 'prod')
    with pytest.raises(Exception):
        trigger.lambda_handler(presignup_event('ag@northwestern.edu', source=source), None)


@pytest.mark.parametrize('verified', ['false', '', 'True'])
def test_unverified_email_rejected(monkeypatch: pytest.MonkeyPatch, verified: str) -> None:
    monkeypatch.setenv('ENVIRONMENT', 'prod')
    with pytest.raises(Exception):
        trigger.lambda_handler(presignup_event('ag@northwestern.edu', verified=verified), None)
