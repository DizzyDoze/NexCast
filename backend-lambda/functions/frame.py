import json
import os
import base64
import boto3
from datetime import datetime
from db.connection import get_db_connection, release_db_connection

s3 = boto3.client('s3')

def handler(event, context):
    """
    Frame upload endpoint
    POST /frame/upload
    """
    method = event.get('httpMethod', '')

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }

    # Parse body
    body = {}
    if event.get('body'):
        body = json.loads(event.get('body', '{}'))

    session_id = body.get('session_id')
    frame_data = body.get('frame_data')  # Base64 encoded image

    if not session_id or not frame_data:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'session_id and frame_data required'})
        }

    conn = None
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(frame_data)

        # Generate S3 key
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')
        s3_key = f"frames/{session_id}/{timestamp}.jpg"

        # Upload to S3
        bucket_name = os.getenv('S3_BUCKET_NAME')
        s3.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=image_bytes,
            ContentType='image/jpeg'
        )

        # Store reference in database
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO frame_uploads (session_id, frame_s3_key) VALUES (%s, %s)",
            (session_id, s3_key)
        )
        frame_id = cursor.lastrowid

        conn.commit()

        return {
            'statusCode': 201,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'frame_id': frame_id,
                's3_key': s3_key,
                'status': 'uploaded'
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
