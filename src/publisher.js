// Load environment variables from .env file
require('dotenv').config();

const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
let credentials = require(process.env.CREDENTIALS_PATH);
// Replace with your own credentials
const CLIENT_ID = credentials.installed.client_id;
const CLIENT_SECRET = credentials.installed.client_secret;
const REDIRECT_URI = credentials.installed.redirect_uris[0];
// or your redirect URI
const REFRESH_TOKEN = process.env.REFRESH_TOKEN; // Ideally obtained after initial OAuth 2.0 flow

const oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN,
});

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});

async function updateVideoTitle(videoId, newTitle) {
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
