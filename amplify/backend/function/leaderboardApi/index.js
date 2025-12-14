/**
 * AWS Lambda function for Classic Games Arcade Leaderboard API
 *
 * Endpoints:
 * - GET /scores/{gameId}     - Get top 10 scores for a specific game
 * - GET /scores              - Get top 3 scores for all games
 * - POST /scores/{gameId}    - Submit a new score
 *
 * Environment Variables:
 * - TABLE_NAME: DynamoDB table name (default: GameLeaderboards)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
    DynamoDBDocumentClient,
    QueryCommand,
    PutCommand,
    DeleteCommand,
    ScanCommand
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'GameLeaderboards';
const MAX_ENTRIES = 10;

// Game configurations (must match leaderboard.js)
const GAMES = {
    'pong': { scoreType: 'high' },
    'flappy-bird': { scoreType: 'high' },
    'snake': { scoreType: 'high' },
    'rooftop-snipers': { scoreType: 'high' },
    'chess': { scoreType: 'high' },
    'city-runner': { scoreType: 'high' },
    'retro-football': { scoreType: 'high' },
    'bedtime-berzerk': { scoreType: 'low' }
};

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const { httpMethod, pathParameters, path } = event;
    const gameId = pathParameters?.gameId;

    try {
        if (httpMethod === 'GET') {
            if (gameId) {
                // GET /scores/{gameId} - Get top 10 for specific game
                const leaderboard = await getLeaderboard(gameId);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(leaderboard)
                };
            } else {
                // GET /scores - Get top 3 for all games
                const allLeaderboards = await getAllLeaderboards();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(allLeaderboards)
                };
            }
        } else if (httpMethod === 'POST' && gameId) {
            // POST /scores/{gameId} - Submit a new score
            const body = JSON.parse(event.body || '{}');
            const { playerName, score } = body;

            if (!playerName || score === undefined) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'playerName and score are required' })
                };
            }

            const result = await submitScore(gameId, playerName, score);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

/**
 * Get the leaderboard for a specific game
 */
async function getLeaderboard(gameId) {
    const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'gameId = :gameId',
        ExpressionAttributeValues: {
            ':gameId': gameId
        },
        Limit: MAX_ENTRIES
    });

    const response = await docClient.send(command);
    const items = response.Items || [];

    // Sort by rank
    items.sort((a, b) => a.rank - b.rank);

    return items.map(item => ({
        playerName: item.playerName,
        score: item.score,
        timestamp: item.timestamp
    }));
}

/**
 * Get top 3 scores for all games
 */
async function getAllLeaderboards() {
    const result = {};

    // Initialize empty arrays for all games
    for (const gameId of Object.keys(GAMES)) {
        result[gameId] = [];
    }

    // Scan the entire table (for small leaderboards this is acceptable)
    const command = new ScanCommand({
        TableName: TABLE_NAME
    });

    const response = await docClient.send(command);
    const items = response.Items || [];

    // Group by game and take top 3
    for (const item of items) {
        if (!result[item.gameId]) {
            result[item.gameId] = [];
        }
        result[item.gameId].push({
            playerName: item.playerName,
            score: item.score,
            timestamp: item.timestamp,
            rank: item.rank
        });
    }

    // Sort and limit to top 3 for each game
    for (const gameId of Object.keys(result)) {
        result[gameId].sort((a, b) => a.rank - b.rank);
        result[gameId] = result[gameId].slice(0, 3).map(item => ({
            playerName: item.playerName,
            score: item.score,
            timestamp: item.timestamp
        }));
    }

    return result;
}

/**
 * Submit a new score
 */
async function submitScore(gameId, playerName, score) {
    const game = GAMES[gameId];
    if (!game) {
        return { qualified: false, rank: -1, error: 'Unknown game' };
    }

    // Get current leaderboard
    const leaderboard = await getLeaderboardWithRanks(gameId);

    // Check if score qualifies
    const rank = getRank(game.scoreType, score, leaderboard);

    if (rank === -1) {
        return { qualified: false, rank: -1 };
    }

    // Insert the new score and reorder
    const newEntry = {
        gameId,
        rank,
        playerName: playerName.substring(0, 10), // Limit name length
        score,
        timestamp: Date.now(),
        scoreType: game.scoreType
    };

    // Shift existing entries down
    const entriesToUpdate = leaderboard.filter(e => e.rank >= rank);
    for (const entry of entriesToUpdate) {
        if (entry.rank < MAX_ENTRIES) {
            // Move to next rank
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: { ...entry, rank: entry.rank + 1 }
            }));
        } else {
            // Delete entry that falls off the leaderboard
            await docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { gameId, rank: entry.rank }
            }));
        }
    }

    // Insert new entry
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newEntry
    }));

    // Clean up any entry at rank 11
    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { gameId, rank: MAX_ENTRIES + 1 }
    }));

    return { qualified: true, rank };
}

/**
 * Get leaderboard with rank information
 */
async function getLeaderboardWithRanks(gameId) {
    const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'gameId = :gameId',
        ExpressionAttributeValues: {
            ':gameId': gameId
        }
    });

    const response = await docClient.send(command);
    const items = response.Items || [];
    items.sort((a, b) => a.rank - b.rank);
    return items;
}

/**
 * Determine the rank a score would achieve
 */
function getRank(scoreType, score, leaderboard) {
    if (leaderboard.length < MAX_ENTRIES) {
        // There's room in the leaderboard
        for (let i = 0; i < leaderboard.length; i++) {
            if (scoreType === 'high' && score > leaderboard[i].score) {
                return i + 1;
            } else if (scoreType === 'low' && score < leaderboard[i].score) {
                return i + 1;
            }
        }
        return leaderboard.length + 1;
    }

    // Leaderboard is full, check if score beats any existing score
    for (let i = 0; i < leaderboard.length; i++) {
        if (scoreType === 'high' && score > leaderboard[i].score) {
            return i + 1;
        } else if (scoreType === 'low' && score < leaderboard[i].score) {
            return i + 1;
        }
    }

    return -1; // Doesn't qualify
}
