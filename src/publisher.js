// Load environment variables from .env file
let fs = require('fs');
require('dotenv').config();
let password = process.env.REDIS_PASSWORD
let redisHost = process.env.REDIS_HOST || 'redis'
let redisPort = process.env.REDIS_PORT || 6379

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
let Queue = require('bull');
async function Processor(job) {
    console.log('Processing job:', job);
    let videoId = job.data.videoId;
    let article = job.data.article;
    const newTitle = article.title; // Replace with your new title
    let newTags = article.hashtags;
    const newDescription = article.description + '\n\n' + article.hashtags.join(' ') + `

Nhóm FB nơi các bạn đóng góp ý kiến, ủng hộ bài viết cho kênh, Ủng hộ vật chất, hoặc có nội dung hay muốn kênh biên tập video:
https://www.facebook.com/groups/606853340648190
Các bạn có thể ủng hộ cho kênh qua STK BIDV: 12110000949742. xin trân trọng cảm ơn
Lưu ý: Chúng tôi không sở hữu tất cả tư liệu được sử dụng trong video này. Một số tư liệu được sử dụng trong video thuộc về các chủ sở hữu đáng kính.
Mọi thắc mắc về bản quyền, tài trợ, quảng cáo, cộng tác vui lòng liên hệ email: qtvhao@gmail.com
We do NOT own all the materials as well as footages used in this video. Please contact qtvhao@gmail.com for copyright matters!
Cảm ơn các bạn đã theo dõi video. Hãy đăng ký kênh để theo dõi nhé`;
    newTags = newTags.slice(0, 12);

    let listVideos = await youtube.videos.list({
        part: 'snippet',
        id: videoId,
    });
    let video = listVideos.data.items[0];
    console.log('Video:', video);
    video.snippet.title = newTitle;
    video.snippet.description = newDescription;
    video.snippet.tags = newTags;
    console.log('Updating video title:', video);
    const response = await youtube.videos.update({
        part: 'snippet',
        requestBody: {
            id: videoId,
            snippet: video.snippet,
        },
    });
    console.log('Updated video:', response.data);
}
async function boot() {
    console.log('Checking for authentication...');
    if (fs.existsSync(TOKEN_PATH)) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
        // check if the token is expired
        if (tokens.expiry_date > new Date().getTime()) {
            oauth2Client.setCredentials(tokens);
            authenticationSuccess = true;
        }
    }
    console.log('Authentication success:', authenticationSuccess);
    
    if (!authenticationSuccess) {
        app.listen(8080, () => {
            console.log('Server is running on port 8080');
        });
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/youtube'],
        });
        console.log('Please authorize this app by visiting this url:', authUrl);
    }
    while (true) {
        console.log('Waiting for authentication...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (authenticationSuccess) {
            break;
        }
    }
    try {
        if (process.env.QUEUE_NAME) {
            let opts = {
                redis: {
                    port: redisPort,
                    host: redisHost,
                    password
                }
            };
            console.log('Processing jobs from queue:', process.env.QUEUE_NAME);
            const queue = new Queue(process.env.QUEUE_NAME, opts);
            queue.process(Processor);
            //queue.add(job);
        }else{
            let job = JSON.parse(fs.readFileSync('/app/draftJob.json'));
            await Processor(job);
        }
    } catch (error) {
        console.error('Error updating video title:', error);
    }
}

boot();
