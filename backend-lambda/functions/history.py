import json
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
    Session history endpoints
    GET /history/{session_id}
    GET /history/list
    """
    # HTTP API v2 event structure
    path = event.get('rawPath', event.get('path', ''))
    method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', ''))
    cors_headers = get_cors_headers(event)

    # Handle OPTIONS for CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }

    # Get user from Cognito authorizer (HTTP API v2)
    user_sub = None
    authorizer = event.get('requestContext', {}).get('authorizer', {})
    if authorizer.get('jwt', {}).get('claims'):
        user_sub = authorizer['jwt']['claims']['sub']
    elif authorizer.get('claims'):  # Fallback for REST API
        user_sub = authorizer['claims']['sub']

    if not user_sub:
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'error': 'Unauthorized'})
        }

    # Route to appropriate handler
    if '/list' in path and method == 'GET':
        return list_sessions(user_sub, event)
    elif method == 'GET':
        # Extract session_id from path (e.g., /history/123)
        path_parts = path.strip('/').split('/')
        if len(path_parts) >= 2:
            session_id = path_parts[-1]
            if session_id.isdigit():
                return get_session_history(session_id, user_sub, event)

    return {
        'statusCode': 404,
        'headers': cors_headers,
        'body': json.dumps({'error': f'Not found: {method} {path}'})
    }


def list_sessions(user_sub, event):
    """List all sessions for a user"""
    cors_headers = get_cors_headers(event)
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, s.started_at, s.ended_at, s.status, s.frame_count,
                   s.voice, s.commentary_style, s.speaking_rate, s.pitch, s.volume,
                   COUNT(c.id) as commentary_count
            FROM sessions s
            LEFT JOIN commentaries c ON c.session_id = s.id
            JOIN users u ON u.id = s.user_id
            WHERE u.cognito_sub = %s
            GROUP BY s.id, s.started_at, s.ended_at, s.status, s.frame_count,
                     s.voice, s.commentary_style, s.speaking_rate, s.pitch, s.volume
            ORDER BY s.started_at DESC
        """, (user_sub,))

        sessions = []
        for row in cursor.fetchall():
            # Calculate duration
            duration = None
            if row['started_at'] and row['ended_at']:
                duration = int((row['ended_at'] - row['started_at']).total_seconds())

            sessions.append({
                'session_id': row['id'],
                'started_at': row['started_at'].isoformat() if row['started_at'] else None,
                'ended_at': row['ended_at'].isoformat() if row['ended_at'] else None,
                'duration': duration,
                'status': row['status'],
                'frame_count': row['frame_count'],
                'preferences': {
                    'voice': row['voice'],
                    'commentary_style': row['commentary_style'],
                    'speaking_rate': float(row['speaking_rate']) if row['speaking_rate'] else 1.0,
                    'pitch': float(row['pitch']) if row['pitch'] else 0.0,
                    'volume': row['volume']
                },
                'commentary_count': row['commentary_count']
            })

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({'sessions': sessions})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)


def get_session_history(session_id, user_sub, event):
    """Get detailed history for a specific session"""
    cors_headers = get_cors_headers(event)
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get session details and verify ownership
        cursor.execute("""
            SELECT s.id, s.started_at, s.ended_at, s.status, s.frame_count,
                   s.voice, s.commentary_style, s.speaking_rate, s.pitch, s.volume
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = %s AND u.cognito_sub = %s
        """, (session_id, user_sub))

        session_row = cursor.fetchone()
        if session_row is None:
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Session not found'})
            }

        # Calculate duration
        duration = None
        if session_row['started_at'] and session_row['ended_at']:
            duration = int((session_row['ended_at'] - session_row['started_at']).total_seconds())

        # Get commentaries
        cursor.execute("""
            SELECT id, commentator_model, scene_description,
                   commentary_text, audio_url, created_at
            FROM commentaries
            WHERE session_id = %s
            ORDER BY created_at ASC
        """, (session_id,))

        commentaries = []
        for row in cursor.fetchall():
            commentaries.append({
                'id': row['id'],
                'commentator_model': row['commentator_model'],
                'scene_description': row['scene_description'],
                'commentary_text': row['commentary_text'],
                'audio_url': row['audio_url'],
                'created_at': row['created_at'].isoformat() if row['created_at'] else None
            })

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'session_id': int(session_id),
                'started_at': session_row['started_at'].isoformat() if session_row['started_at'] else None,
                'ended_at': session_row['ended_at'].isoformat() if session_row['ended_at'] else None,
                'duration': duration,
                'status': session_row['status'],
                'frame_count': session_row['frame_count'],
                'preferences': {
                    'voice': session_row['voice'],
                    'commentary_style': session_row['commentary_style'],
                    'speaking_rate': float(session_row['speaking_rate']) if session_row['speaking_rate'] else 1.0,
                    'pitch': float(session_row['pitch']) if session_row['pitch'] else 0.0,
                    'volume': session_row['volume']
                },
                'commentaries': commentaries
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)
