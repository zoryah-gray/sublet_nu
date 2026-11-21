"""Shared Lambda helpers, shipped as a Lambda Layer and imported as `utils`."""
import os
from functools import cache

import boto3
import psycopg2
from psycopg2.extensions import connection

db_host = os.environ.get('DB_HOST')
db_port = int(os.environ.get('DB_PORT', 5432))
db_name = os.environ.get('DB_NAME')
db_user = os.environ.get('DB_USER')
aws_region = os.environ.get('AWS_REGION')
# Amazon's public RDS root CAs (https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem).
RDS_CA_BUNDLE = os.path.join(os.path.dirname(__file__), 'rds-global-bundle.pem')


@cache
def _rds_client():
    """boto3 RDS client, built once per Lambda container (client creation is slow)."""
    return boto3.client('rds', region_name=aws_region)


def get_auth_token() -> str:
    """Generates an RDS IAM auth token for DB_USER (signed locally, valid 15 min).

    Output: token string, used as the Postgres password.
    """
    return _rds_client().generate_db_auth_token(
        DBHostname=db_host,
        Port=db_port,
        DBUsername=db_user,
        Region=aws_region,
    )


def get_db_connection() -> connection:
    """Opens a TLS Postgres connection to the RDS instance using an IAM token.

    Output: open psycopg2 connection. verify-full checks the server certificate
    and hostname, so the IAM token is never sent to an impostor. connect_timeout
    stays under Cognito's 5 s limit.
    """
    return psycopg2.connect(
        host=db_host,
        user=db_user,
        password=get_auth_token(),
        database=db_name,
        port=db_port,
        sslmode='verify-full',
        sslrootcert=RDS_CA_BUNDLE,
        connect_timeout=3,
    )


def avatar_initials(full_name: str | None, display_name: str) -> str:
    """Derives avatar initials at read time; never stored.

    Input: full_name (nullable), display_name. Output: first letters of the first
    and last words of full_name ("Ally Goodman" -> "AG"); if full_name is NULL or
    blank, the first letter of display_name ("allygoodman" -> "A").
    """
    words = (full_name or '').split()
    if not words:
        return display_name[:1].upper()
    if len(words) == 1:
        return words[0][0].upper()
    return (words[0][0] + words[-1][0]).upper()
