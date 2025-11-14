import json
import os
from db.connection import get_db_connection, release_db_connection

def handler(event, context):
    """
    Session management endpoints
    POST /session/start
    POST /session/end
    """
    # HTTP API v2 event structure
    path = event.get('rawPath', event.get('path', ''))
    method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', ''))

    # Parse body
    body = {}
    if event.get('body'):
        body = json.loads(event.get('body', '{}'))

    # Get user from Cognito authorizer (HTTP API v2)
    user_sub = None
    authorizer = event.get('requestContext', {}).get('authorizer', {})
    if authorizer.get('jwt', {}).get('claims'):
        user_sub = authorizer['jwt']['claims']['sub']
    elif authorizer.get('claims'):  # Fallback for REST API
        user_sub = authorizer['claims']['sub']

    # Route to appropriate handler
    if path.endswith('/start') and method == 'POST':
        return start_session(user_sub)
    elif path.endswith('/end') and method == 'POST':
        return end_session(body.get('session_id'))

    return {
        'statusCode': 404,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': f'Not found: {method} {path}'})
    }


def start_session(user_sub):
    """Start a new session"""
    if not user_sub:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get or create user
        cursor.execute(
            "INSERT INTO users (cognito_sub) VALUES (%s) ON DUPLICATE KEY UPDATE cognito_sub = cognito_sub",
            (user_sub,)
        )

        # Get user_id
        cursor.execute("SELECT id FROM users WHERE cognito_sub = %s", (user_sub,))
        user_id = cursor.fetchone()['id']

        # Create session
        cursor.execute(
            "INSERT INTO sessions (user_id, status) VALUES (%s, 'active')",
            (user_id,)
        )
        session_id = cursor.lastrowid

        conn.commit()

        return {
            'statusCode': 201,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'session_id': session_id,
                'status': 'active'
            })
        }
    except Exception as e:
        if conn:
            conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)


def end_session(session_id):
    """End an active session"""
    if not session_id:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'session_id required'})
        }

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE sessions SET ended_at = NOW(), status = 'ended' WHERE id = %s",
            (session_id,)
        )

        if cursor.rowcount == 0:
            return {
                'statusCode': 404,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Session not found'})
            }

        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'session_id': session_id,
                'status': 'ended'
            })
        }
    except Exception as e:
        if conn:
            conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)
