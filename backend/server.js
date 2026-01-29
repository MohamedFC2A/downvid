require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { fetchVideoData } = require('./videoService');
const { createUpscalePrediction, getUpscaleStatus } = require('./replicateService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => {
    console.warn('[redis] error', err?.message || err);
});

(async () => {
    try {
        await redisClient.connect();
        console.log('[redis] connected');
    } catch (err) {
        console.warn('[redis] connection failed', err?.message || err);
    }
})();

app.post('/api/download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const data = await fetchVideoData(url, redisClient);
        res.json(data);
    } catch (error) {
        console.error('API Error:', error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : 'Internal Server Error';
        res.status(status).json({ error: message });
    }
});

app.post('/api/upscale', async (req, res) => {
    const { videoUrl, model } = req.body || {};

    if (!videoUrl) {
        return res.status(400).json({ error: 'videoUrl is required' });
    }

    try {
        const prediction = await createUpscalePrediction(videoUrl, { model });
        res.json({
            predictionId: prediction.id,
            status: prediction.status,
        });
    } catch (error) {
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : error.message || 'Failed to start upscale job';
        res.status(status).json({ error: message });
    }
});

app.get('/api/upscale/status/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const prediction = await getUpscaleStatus(id);
        const output = Array.isArray(prediction.output)
            ? prediction.output[prediction.output.length - 1]
            : prediction.output;
        const status = prediction.status === 'succeeded' ? 'succeeded' : 'processing';
        res.json({ status, output: output || null });
    } catch (error) {
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : error.message || 'Failed to fetch upscale status';
        res.status(status).json({ error: message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        redis: redisClient.isReady ? 'ready' : 'offline',
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
