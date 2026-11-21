"""UsersTableResetFn (throwaway): empties users and every table referencing it, as migrator_role (the owner).

CASCADE because a plain TRUNCATE fails on a table that foreign keys reference, even when the
referencing tables are empty. It also empties sublets, requests, messages, etc.
"""
from utils import get_db_connection

STATEMENT = 'TRUNCATE TABLE users CASCADE'


def lambda_handler(event, context):
    """Runs the fixed TRUNCATE in one transaction.

    Input: ignored, so a caller can't pick the table or the statement. Output: None.
    """
    conn = get_db_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(STATEMENT)
    finally:
        conn.close()

    print('Truncated users table and all tables referencing it (CASCADE)')
