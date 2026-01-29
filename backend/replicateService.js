const Replicate = require('replicate');

const MODEL_MAP = {
    'real-esrgan': {
        model: 'nightmareai/real-esrgan',
        inputKey: process.env.REPLICATE_REAL_ESRGAN_INPUT || 'image',
    },
    'video-enhance': {
        model: 'iso-m/video-upscaler',
        inputKey: process.env.REPLICATE_VIDEO_UPSCALER_INPUT || 'video',
    },
};

function resolveModelConfig(modelKey, inputKeyOverride) {
    const key = (modelKey || process.env.REPLICATE_MODEL || 'real-esrgan').toLowerCase();
    if (MODEL_MAP[key]) {
        return {
            model: MODEL_MAP[key].model,
            inputKey: inputKeyOverride || MODEL_MAP[key].inputKey,
        };
    }

    return {
        model: modelKey || process.env.REPLICATE_MODEL || 'nightmareai/real-esrgan',
        inputKey: inputKeyOverride || process.env.REPLICATE_MODEL_INPUT || 'video',
    };
}

function createReplicateClient() {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
        throw new Error('REPLICATE_API_TOKEN is not configured');
    }
    return new Replicate({ auth: token });
}

async function createUpscalePrediction(videoUrl, options = {}) {
    if (!videoUrl) {
        throw new Error('videoUrl is required');
    }

    const replicate = createReplicateClient();
    const { model, inputKey } = resolveModelConfig(options.model, options.inputKey);
    const input = {
        [inputKey]: videoUrl,
        ...(options.input || {}),
    };

    const payload = {
        input,
    };

    if (options.version || process.env.REPLICATE_MODEL_VERSION) {
        payload.version = options.version || process.env.REPLICATE_MODEL_VERSION;
    } else {
        payload.model = model;
    }

    return replicate.predictions.create(payload);
}

async function getUpscaleStatus(predictionId) {
    if (!predictionId) {
        throw new Error('predictionId is required');
    }

    const replicate = createReplicateClient();
    return replicate.predictions.get(predictionId);
}

module.exports = {
    createUpscalePrediction,
    getUpscaleStatus,
};