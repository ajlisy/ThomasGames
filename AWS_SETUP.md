# AWS Amplify Leaderboard Setup

This guide explains how to set up the leaderboard backend on AWS Amplify.

## Prerequisites

1. AWS Account
2. AWS Amplify CLI installed (`npm install -g @aws-amplify/cli`)
3. Amplify CLI configured (`amplify configure`)

## Setup Steps

### 1. Initialize Amplify (if not already done)

```bash
cd /Users/andrew/ThomasPong
amplify init
```

Follow the prompts to set up your Amplify project.

### 2. Create DynamoDB Table

You can create the table using the AWS Console or CLI:

**Using AWS Console:**
1. Go to DynamoDB in AWS Console
2. Click "Create table"
3. Table name: `GameLeaderboards`
4. Partition key: `gameId` (String)
5. Sort key: `rank` (Number)
6. Leave other settings as default
7. Click "Create table"

**Using AWS CLI:**
```bash
aws dynamodb create-table \
    --table-name GameLeaderboards \
    --attribute-definitions \
        AttributeName=gameId,AttributeType=S \
        AttributeName=rank,AttributeType=N \
    --key-schema \
        AttributeName=gameId,KeyType=HASH \
        AttributeName=rank,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST
```

### 3. Create Lambda Function

```bash
amplify add function
```

Options:
- Select "Lambda function"
- Name: `leaderboardApi`
- Runtime: `NodeJS`
- Template: `Hello World`

Then replace the generated code with the contents of `amplify/backend/function/leaderboardApi/index.js`.

### 4. Add API Gateway

```bash
amplify add api
```

Options:
- Select "REST"
- Name: `leaderboardapi`
- Path: `/scores`
- Lambda function: Select the `leaderboardApi` function
- Restrict API access: No

Add another path for `/scores/{gameId}` pointing to the same Lambda function.

### 5. Set Environment Variables

In the AWS Lambda console or via Amplify:
- `TABLE_NAME`: `GameLeaderboards`

### 6. Add DynamoDB Permissions

Add the following policy to the Lambda function's execution role:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/GameLeaderboards"
        }
    ]
}
```

### 7. Deploy

```bash
amplify push
```

### 8. Update Frontend

After deployment, update the `API_BASE` variable in `leaderboard.js` with your API Gateway URL:

```javascript
const API_BASE = 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod';
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/scores/{gameId}` | Get top 10 scores for a specific game |
| GET | `/scores` | Get top 3 scores for all games |
| POST | `/scores/{gameId}` | Submit a new score |

### POST Request Body

```json
{
    "playerName": "Player Name",
    "score": 12345
}
```

### Response

```json
{
    "qualified": true,
    "rank": 1
}
```

## Local Development

When running locally (`localhost` or `127.0.0.1`), the leaderboard system automatically uses browser localStorage instead of the API. This allows you to test without setting up AWS.

## Troubleshooting

1. **CORS errors**: Ensure the Lambda function returns proper CORS headers
2. **Permission denied**: Check the Lambda execution role has DynamoDB permissions
3. **Table not found**: Verify the TABLE_NAME environment variable matches your DynamoDB table name
