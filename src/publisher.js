// Load environment variables from .env file
let fs = require('fs');
require('dotenv').config();

const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
let credentials = require(process.env.CREDENTIALS_PATH);
// Replace with your own credentials
const CLIENT_ID = credentials.installed.client_id;
const CLIENT_SECRET = credentials.installed.client_secret;
const REDIRECT_URI = credentials.installed.redirect_uris[0];
// or your redirect URI
// const REFRESH_TOKEN = process.env.REFRESH_TOKEN; // Ideally obtained after initial OAuth 2.0 flow

const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
/* oauth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN,
});
 */
const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
});
let authenticationSuccess = false;
let TOKEN_PATH = process.env.TOKEN_PATH || 'token.json';
if (fs.existsSync(TOKEN_PATH)) {
    const tokens = fs.readFileSync(TOKEN_PATH);
    oauth2Client.setCredentials(JSON.parse(tokens));
    authenticationSuccess = true;
}

let express = require('express');
let app = express();
app.get('/auth/google/callback', (req, res) => {
    const code = req.query.code;
    if (code) {
        oauth2Client.getToken(code, (err, tokens) => {
            if (err) {
                console.error('Error authenticating', err);
                return res.sendStatus(500);
            }

            oauth2Client.setCredentials(tokens);
            fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
                if (err) {
                    console.error('Error writing tokens', err);
                    return res.sendStatus(500);
                }
            });

            authenticationSuccess = true;
            res.send('Authentication successful! You can close this tab now.');
        });
    } else {
        res.sendStatus(400);
    }
});
app.listen(8080, () => {
    console.log('Server is running on port 8080');
});
async function updateVideoTitle(videoId, newTitle) {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube'],
    });
    if (!authenticationSuccess) {
        console.log('Please authorize this app by visiting this url:', authUrl);
    }
    while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (authenticationSuccess) {
            break;
        }
    }
    try {
        const response = await youtube.videos.update({
            part: 'snippet',
            requestBody: {
                id: videoId,
                snippet: {
                    title: newTitle,
                    // You can include other properties like description, tags, etc.
                },
            },
        });

        console.log('Video title updated successfully:', response.data);
    } catch (error) {
        console.error('Error updating video title:', error);
    }
}

// Example usage
const videoId = 'R6-9K7BhWZc'; // Replace with your video ID
const newTitle = 'New Video Title'; // Replace with your new title

updateVideoTitle(videoId, newTitle);
