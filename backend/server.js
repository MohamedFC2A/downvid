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
        res.json(data);
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
