"""UsersTableCheckFn (throwaway): returns the newest users rows to whoever invokes it.

Rows hold PII (email, full_name), so they are only returned, never logged.
"""
from datetime import datetime

from utils import get_db_connection

QUERY = 'SELECT cognito_sub, email, display_name, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 5'
COLUMNS = ('cognito_sub', 'email', 'display_name', 'full_name', 'created_at')


def lambda_handler(event, context):
    """Runs the fixed users query as app_user.

    Input: ignored. Output: {'rows': [...]}, one dict per row, created_at as ISO 8601.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(QUERY)
            rows = cur.fetchall()
    finally:
        conn.close()

    print(f'Users table check returned {len(rows)} row(s)')
    return {
        'rows': [
            {column: value.isoformat() if isinstance(value, datetime) else value for column, value in zip(COLUMNS, row)}
            for row in rows
        ],
    }
