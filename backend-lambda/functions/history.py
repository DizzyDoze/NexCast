import json
from db.connection import get_db_connection, release_db_connection

def handler(event, context):
    """
    Session history endpoints
    GET /history/{session_id}
    GET /history/list
    """
    # HTTP API v2 event structure
    path = event.get('rawPath', event.get('path', ''))
    method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', ''))

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
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }

    # Route to appropriate handler
    if '/list' in path and method == 'GET':
        return list_sessions(user_sub)
    elif method == 'GET':
        # Extract session_id from path (e.g., /history/123)
        path_parts = path.strip('/').split('/')
        if len(path_parts) >= 2:
            session_id = path_parts[-1]
            if session_id.isdigit():
                return get_session_history(session_id, user_sub)

    return {
        'statusCode': 404,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': f'Not found: {method} {path}'})
    }


def list_sessions(user_sub):
    """List all sessions for a user"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.id, s.started_at, s.ended_at, s.status,
                   COUNT(c.id) as commentary_count
            FROM sessions s
            LEFT JOIN commentaries c ON c.session_id = s.id
            JOIN users u ON u.id = s.user_id
            WHERE u.cognito_sub = %s
            GROUP BY s.id, s.started_at, s.ended_at, s.status
            ORDER BY s.started_at DESC
        """, (user_sub,))

        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                'session_id': row['id'],
                'started_at': row['started_at'].isoformat() if row['started_at'] else None,
                'ended_at': row['ended_at'].isoformat() if row['ended_at'] else None,
                'status': row['status'],
                'commentary_count': row['commentary_count']
            })

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'sessions': sessions})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)


def get_session_history(session_id, user_sub):
    """Get detailed history for a specific session"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verify session belongs to user
        cursor.execute("""
            SELECT s.id FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = %s AND u.cognito_sub = %s
        """, (session_id, user_sub))

        if cursor.fetchone() is None:
            return {
                'statusCode': 404,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Session not found'})
            }

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
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'session_id': int(session_id),
                'commentaries': commentaries
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            release_db_connection(conn)
