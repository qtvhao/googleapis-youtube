// Load environment variables from .env file
let fs = require('fs');
// require('dotenv').config();
let password = process.env.REDIS_PASSWORD
let redisHost = process.env.REDIS_HOST || 'redis'
let redisPort = process.env.REDIS_PORT || 6379

const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
let credentials = require(process.env.CREDENTIALS_PATH);
// Replace with your own credentials
const CLIENT_ID = credentials.web.client_id;
const CLIENT_SECRET = credentials.web.client_secret;
const REDIRECT_URI = credentials.web.redirect_uris[0];
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
oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
        // store the refresh_token in your secure persistent database
        console.log(tokens.refresh_token);
    }
    console.log(tokens.access_token);
});

app.get('/auth/google/callback', (req, res) => {
    const code = req.query.code;
    if (code) {
        oauth2Client.getToken(code, (err, tokens) => {
            if (err) {
                console.error('Error authenticating', err);
                return res.sendStatus(500);
            }
            /**
                * Set the value to 'offline' if your application needs to refresh access tokens when the user
                * is not present at the browser.
             */
            let expiry_seconds = tokens.expiry_date - Math.floor(Date.now());
            console.log('Expires In: ' + expiry_seconds + 's');

            console.log('Tokens:', tokens);
            if (tokens.refresh_token) {
                // store the refresh_token in your secure persistent database
                console.log(tokens.refresh_token);
            } else {
                throw new Error('No refresh token is set. We need to authenticate the user.');
            }
            console.log(tokens.access_token);

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
async function authentication() {
    // No refresh token is set. We need to authenticate the user.
    console.log('No refresh token is set. We need to authenticate the user.');
}
async function Processor(job) {
    console.log('Processing job:', job);
    let videoId = job.data.videoId;
    let article = job.data.article;
    const newTitle = article.title; // Replace with your new title
    let newTags = article.hashtags;
    let description = article.description;
    try {
        description = JSON.parse(description);
    } catch (e) { }
    const newDescription = description + '\n\n' + `Bạn có thể tìm hiểu thêm thông tin về chủ đề này bằng từ khóa ${article.name}.` + '\n\n' + article.hashtags.join(' ') + `

Nhóm FB nơi các bạn đóng góp ý kiến, ủng hộ bài viết cho kênh, Ủng hộ vật chất, hoặc có nội dung hay muốn kênh biên tập video:
https://www.facebook.com/groups/606853340648190
Các bạn có thể ủng hộ cho kênh qua STK BIDV: 12110000949742. xin trân trọng cảm ơn
Lưu ý: Chúng tôi không sở hữu tất cả tư liệu được sử dụng trong video này. Một số tư liệu được sử dụng trong video thuộc về các chủ sở hữu đáng kính.
Mọi thắc mắc về bản quyền, tài trợ, quảng cáo, cộng tác vui lòng liên hệ email: qtvhao@gmail.com
We do NOT own all the materials as well as footages used in this video. Please contact qtvhao@gmail.com for copyright matters!
Cảm ơn các bạn đã theo dõi video. Hãy đăng ký kênh để theo dõi nhé`;
    newTags = newTags.slice(0, 12);

    let listVideos;
    try {
        listVideos = await youtube.videos.list({
            part: 'snippet',
            id: videoId,
        });
    } catch (e) {
        // No refresh token is set. We need to authenticate the user.
        console.error('Error listing videos:', e);
        await authentication();
        await new Promise(resolve => setTimeout(resolve, 1000));
        throw e;
    }
    let video = listVideos.data.items[0];
    console.log('Video:', video);
    video.snippet.title = newTitle;
    if (video.snippet.title.length > 99) {
        // elipsis is 3 characters
        video.snippet.title = video.snippet.title.substring(0, 96) + '...';
    }
    video.snippet.description = newDescription;
    video.snippet.tags = newTags;
    while (video.snippet.tags.join(',').length > 499) {
        let pop = video.snippet.tags.pop();
        console.log('Popping tag:', pop);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('Updating video title:', video);
    // The request metadata specifies an invalid or empty video title.
    job.log('Updating snippet: ' + JSON.stringify(video.snippet));
    const response = await youtube.videos.update({
        part: 'snippet',
        requestBody: {
            id: videoId,
            snippet: video.snippet,
        },
    });
    console.log('Updated video:', response.data);
}

// Search for videos
async function searchVideos(articleName) {
    const youtube = google.youtube('v3');
    const res = await youtube.search.list({
        // auth,
        part: 'snippet',
        forMine: true, // Search only your uploaded videos
        // q: 'Connected', // Search for videos with "Connected" in the description
        type: 'video',
    });
    console.log(res.data.items); // Print the found videos
    let matcher = `Bạn có thể tìm hiểu thêm thông tin về chủ đề này bằng từ khóa ${articleName}.`;
    let filteredVideo = res.data.items.find((video) => {
        return video.snippet.description.includes(matcher);
    });

    return filteredVideo;
}
async function boot() {
    console.log('Checking for authentication...');
    if (fs.existsSync(TOKEN_PATH)) {
        console.log('Token file exists');
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
        // check if the token is expired
        console.log('Token is:', tokens);
        oauth2Client.setCredentials({
            refresh_token: tokens.refresh_token,
        });
        authenticationSuccess = true;
    }
    console.log(authenticationSuccess ? 'Authenticated' : 'Not authenticated');

    if (!authenticationSuccess) {
        app.listen(8080, () => {
            console.log('Server is running on port 8080');
        });
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            // prompt=consent
            prompt: 'consent',
            include_granted_scopes: true,
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
            youtube.videos.list({
                part: 'snippet',
                id: 'D5zTsC_89v8',
            }).then(() => {
                app.post('/check-uploaded-video', async (req, res) => {
                    console.log('Checking uploaded video:', req.body);
                    let articleName = req.body.articleName;
                    //
                    let filteredVideo = await searchVideos(articleName);

                    let isVideoUploaded = typeof filteredVideo !== 'undefined' && filteredVideo !== null;

                    res.send({
                        isVideoUploaded,
                        videoId: filteredVideo.id,
                    });
                });
                console.log('Connected to youtube: ' + 'D5zTsC_89v8');
                app.listen(8080, () => {
                    console.log('Server is running on port 8080');
                });
                queue.process(Processor);
            }).catch((e) => {
                console.error('Error listing videos:', e);
                // No refresh token is set. We need to authenticate the user.
                authentication();
                process.exit(1);
            });
            //queue.add(job);
        } else {
            let job = JSON.parse(fs.readFileSync('/app/draftJob.json'));
            await Processor(job);
        }
    } catch (error) {
        console.error('Error updating video title:', error);
    }
}

boot();
