import json
import os
import boto3

cognito = boto3.client('cognito-idp')

def handler(event, context):
    """
    Authentication endpoints
    POST /auth/login
    POST /auth/register
    """
    path = event.get('path', '')
    method = event.get('httpMethod', '')

    # Parse body
    body = {}
    if event.get('body'):
        body = json.loads(event.get('body', '{}'))

    # Route to appropriate handler
    if path.endswith('/login') and method == 'POST':
        return login(body)
    elif path.endswith('/register') and method == 'POST':
        return register(body)

    return {
        'statusCode': 404,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Not found'})
    }


def login(body):
    """Handle user login"""
    username = body.get('username')
    password = body.get('password')

    if not username or not password:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Username and password required'})
        }

    try:
        response = cognito.initiate_auth(
            ClientId=os.getenv('COGNITO_CLIENT_ID'),
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': username,
                'PASSWORD': password
            }
        )

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'access_token': response['AuthenticationResult']['AccessToken'],
                'id_token': response['AuthenticationResult']['IdToken'],
                'refresh_token': response['AuthenticationResult']['RefreshToken']
            })
        }
    except Exception as e:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }


def register(body):
    """Handle user registration"""
    username = body.get('username')
    password = body.get('password')
    email = body.get('email')

    if not username or not password or not email:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Username, password, and email required'})
        }

    try:
        response = cognito.sign_up(
            ClientId=os.getenv('COGNITO_CLIENT_ID'),
            Username=username,
            Password=password,
            UserAttributes=[
                {'Name': 'email', 'Value': email}
            ]
        )

        return {
            'statusCode': 201,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'user_sub': response['UserSub'],
                'message': 'User registered successfully'
            })
        }
    except Exception as e:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
