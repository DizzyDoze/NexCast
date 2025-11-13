import json

def handler(event, context):
    """
    Health check endpoint
    GET /health
    """
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'status': 'healthy',
            'service': 'NexCast API'
        })
    }
