"""UsersTableResetFn (throwaway): empties the users table, as migrator_role (its owner)."""
from utils import get_db_connection

STATEMENT = 'TRUNCATE TABLE users'


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

    print('Truncated users table')
