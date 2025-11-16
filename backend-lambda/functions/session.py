import json
import os
from db.connection import get_db_connection, release_db_connection

def get_cors_headers(event):
    """Get CORS headers for response"""
    origin = event.get('headers', {}).get('origin', '*')
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true'
    }

def handler(event, context):
    """
    Session management endpoints
    POST /session/start
    POST /session/end
    """
    # HTTP API v2 event structure
    path = event.get('rawPath', event.get('path', ''))
    method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', ''))

    # Handle OPTIONS for CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': get_cors_headers(event),
            'body': ''
        }

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
        return start_session(user_sub, body, event)
    elif path.endswith('/end') and method == 'POST':
        return end_session(body.get('session_id'), body.get('frame_count', 0), event)

    return {
        'statusCode': 404,
        'headers': get_cors_headers(event),
        'body': json.dumps({'error': f'Not found: {method} {path}'})
    }


def start_session(user_sub, body, event):
    """Start a new session with preferences"""
    cors_headers = get_cors_headers(event)

    if not user_sub:
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized'})
        }

    # Extract preferences (all optional with defaults)
    preferences = body.get('preferences', {})
    voice = preferences.get('voice', 'en-US-Neural2-A')
    commentary_style = preferences.get('commentary_style', 'excited')
    speaking_rate = float(preferences.get('speaking_rate', 1.0))
    pitch = float(preferences.get('pitch', 0.0))
    volume = int(preferences.get('volume', 100))

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

        # Create session with preferences
        cursor.execute("""
            INSERT INTO sessions
            (user_id, status, voice, commentary_style, speaking_rate, pitch, volume)
            VALUES (%s, 'active', %s, %s, %s, %s, %s)
        """, (user_id, voice, commentary_style, speaking_rate, pitch, volume))
        session_id = cursor.lastrowid

        conn.commit()

        return {
            'statusCode': 201,
            'headers': cors_headers,
            'body': json.dumps({
                'session_id': session_id,
                'status': 'active',
                'preferences': {
                    'voice': voice,
                    'commentary_style': commentary_style,
                    'speaking_rate': speaking_rate,
                    'pitch': pitch,
                    'volume': volume
                }
            })
        }
    except Exception as e:
        if conn:
            conn.rollback()
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)


def end_session(session_id, frame_count, event):
    """End an active session"""
    cors_headers = get_cors_headers(event)

    if not session_id:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'error': 'session_id required'})
        }

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE sessions SET ended_at = NOW(), status = 'ended', frame_count = %s WHERE id = %s",
            (frame_count, session_id)
        )

        if cursor.rowcount == 0:
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Session not found'})
            }

        conn.commit()

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'session_id': session_id,
                'status': 'ended',
                'frame_count': frame_count
            })
        }
    except Exception as e:
        if conn:
            conn.rollback()
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)
