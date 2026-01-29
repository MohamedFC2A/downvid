require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Service Function
const fetchVideoData = async (url) => {
    const options = {
        method: 'POST',
        url: `https://${process.env.RAPIDAPI_HOST}/v1/social/autolink`,
        headers: {
            'x-rapidapi-key': process.env.RAPIDAPI_KEY,
            'x-rapidapi-host': process.env.RAPIDAPI_HOST,
            'Content-Type': 'application/json'
        },
        data: { url: url }
    };

    try {
        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Routes
app.post('/api/download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const data = await fetchVideoData(url);

        // Parse and clean up the response for the frontend
        const cleanData = {
            platform: data.source || 'Unknown', // Adapting to likely field
            title: data.title || 'Video',
            thumbnail: data.thumbnail || '',
            downloads: {
                video: [],
                audio: []
            }
        };

        // Heuristic parsing for common RapidAPI social downloaders (often share similar structures)
        // Adjust based on the actual API used: "Social Download All in One"
        // Most tend to have 'medias', 'links', or 'formats' property.
        const formats = data.medias || data.formats || data.links || [];

        formats.forEach(format => {
            const isAudio = format.type === 'audio' || format.extension === 'mp3' || format.extension === 'm4a' || format.isAudio;
            const qualityScale = format.quality || format.resolution || 'Unknown';
            // Some APIs return '720p (HD)' string, we keep it as is or clean it.

            const item = {
                quality: qualityScale,
                url: format.url,
                size: format.formattedSize || format.size || 'Unknown',
                extension: format.extension || 'mp4',
                requiresMuxing: !format.audio && !isAudio // naive check, real APIs might differ
            };

            if (isAudio) {
                // Ensure audio quality looks nice, e.g. "128kbps"
                if (!item.quality || item.quality === 'Unknown') {
                    item.quality = format.bitrate ? `${format.bitrate}kbps` : 'Audio';
                }
                cleanData.downloads.audio.push(item);
            } else {
                cleanData.downloads.video.push(item);
            }
        });

        // Fallback: If no structured formats found but a single 'url' exists in root
        if (cleanData.downloads.video.length === 0 && cleanData.downloads.audio.length === 0 && data.url) {
            cleanData.downloads.video.push({
                quality: 'Standard',
                url: data.url,
                size: 'Unknown',
                extension: 'mp4'
            });
        }

        res.json(cleanData);
    } catch (error) {
        console.error('API Error:', error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : 'Internal Server Error';
        res.status(status).json({ error: message });
    }
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
