const axios = require('axios');
const crypto = require('crypto');

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const CACHE_PREFIX = 'downvid:rapidapi:v1:';

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'opus', 'ogg']);

function buildCacheKey(url) {
    const hash = crypto.createHash('sha256').update(url).digest('hex');
    return `${CACHE_PREFIX}${hash}`;
}

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function formatBytes(bytes) {
    if (typeof bytes !== 'number' || Number.isNaN(bytes)) return undefined;
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function normalizeQualityLabel(rawValue, heightValue) {
    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
        const lowered = rawValue.toLowerCase();
        if (lowered.includes('8k') || lowered.includes('4320')) return '8K';
        if (lowered.includes('4k') || lowered.includes('2160')) return '4K';
        if (lowered.includes('1440') || lowered.includes('2k')) return '1440p';
        if (lowered.includes('1080')) return '1080p';
        if (lowered.includes('720')) return '720p';
        if (lowered.includes('480')) return '480p';
        if (lowered.includes('360')) return '360p';
        return rawValue;
    }
    if (typeof heightValue === 'number') {
        if (heightValue >= 4320) return '8K';
        if (heightValue >= 2160) return '4K';
        return `${heightValue}p`;
    }
    return 'Standard';
}

function parseHeight(qualityLabel) {
    if (!qualityLabel) return undefined;
    const match = `${qualityLabel}`.match(/(\d{3,4})p/i);
    if (match) {
        const val = Number.parseInt(match[1], 10);
        return Number.isNaN(val) ? undefined : val;
    }
    if (/8k/i.test(qualityLabel)) return 4320;
    if (/4k/i.test(qualityLabel)) return 2160;
    return undefined;
}

function collectFormats(data) {
    const candidates = [
        data?.medias,
        data?.formats,
        data?.links,
        data?.videos,
        data?.downloads,
        data?.data?.medias,
        data?.data?.formats,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return [];
}

function detectAudio(format) {
    const type = `${format?.type || format?.mime || ''}`.toLowerCase();
    const extension = `${format?.extension || format?.ext || ''}`.toLowerCase();
    const isAudioType = type.includes('audio');
    const isAudioExt = AUDIO_EXTENSIONS.has(extension);
    const vcodec = `${format?.vcodec || format?.videoCodec || ''}`.toLowerCase();
    const acodec = `${format?.acodec || format?.audioCodec || ''}`.toLowerCase();
    const explicitAudio = format?.isAudio === true || format?.audio === true;
    const noVideo = vcodec === 'none' || vcodec === '';
    return explicitAudio || isAudioType || isAudioExt || (noVideo && acodec && acodec !== 'none');
}

function normalizeFormat(format, index, hasAudioStreams) {
    const url = format?.url || format?.link || format?.downloadUrl || format?.download_url;
    if (!url) return null;

    const extension = `${format?.extension || format?.ext || format?.container || 'mp4'}`.replace('.', '');
    const isAudio = detectAudio(format);

    const height = typeof format?.height === 'number' ? format.height : undefined;
    const qualityRaw = format?.quality || format?.resolution || format?.qualityLabel || format?.label || format?.format || format?.name;
    const qualityLabel = isAudio
        ? (format?.bitrate ? `${format.bitrate}kbps` : format?.abr ? `${format.abr}kbps` : 'Audio')
        : normalizeQualityLabel(qualityRaw, height);

    const filesize = format?.formattedSize || format?.size || format?.filesize || format?.fileSize;
    const sizeLabel = typeof filesize === 'number' ? formatBytes(filesize) : filesize;

    const vcodec = format?.vcodec || format?.videoCodec || (isAudio ? 'none' : undefined);
    const acodec = format?.acodec || format?.audioCodec || (isAudio ? extension : undefined);

    const hasAudio = Boolean(format?.audio) || (acodec && acodec !== 'none');
    const requiresMuxing = !isAudio && !hasAudio && hasAudioStreams;

    const noteParts = [];
    if (format?.note) noteParts.push(format.note);
    if (requiresMuxing) noteParts.push('Video-only (needs audio merge)');

    return {
        format_id: `${format?.format_id || format?.id || format?.itag || `${extension}-${index}`}`,
        resolution: qualityLabel,
        filesize_str: sizeLabel || 'Unknown',
        note: noteParts.join(' | '),
        extension,
        height: height || parseHeight(qualityLabel),
        fps: format?.fps,
        vcodec,
        acodec: hasAudio ? acodec : 'none',
        abr: format?.abr,
        url,
        requiresMuxing,
    };
}

function buildCleanData(rawData) {
    const formats = collectFormats(rawData);
    const audioStreams = formats.filter(detectAudio).length > 0;

    const video = [];
    const audio = [];

    formats.forEach((format, index) => {
        const normalized = normalizeFormat(format, index, audioStreams);
        if (!normalized) return;
        if (detectAudio(format)) {
            audio.push(normalized);
        } else {
            video.push(normalized);
        }
    });

    if (video.length === 0 && audio.length === 0 && rawData?.url) {
        video.push({
            format_id: 'standard',
            resolution: 'Standard',
            filesize_str: 'Unknown',
            note: '',
            extension: 'mp4',
            url: rawData.url,
        });
    }

    video.sort((a, b) => (b.height || 0) - (a.height || 0));
    audio.sort((a, b) => (b.abr || 0) - (a.abr || 0));

    return {
        platform: rawData?.source || rawData?.platform || rawData?.provider || 'Unknown',
        title: rawData?.title || rawData?.name || 'Video',
        thumbnail: rawData?.thumbnail || rawData?.thumb || rawData?.image || '',
        downloads: {
            video,
            audio,
        },
    };
}

async function fetchVideoData(url, redisClient) {
    if (!url) {
        throw new Error('URL is required');
    }

    const cacheKey = buildCacheKey(url);

    if (redisClient?.isReady) {
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                const parsed = safeJsonParse(cached);
                if (parsed?.payload) return parsed.payload;
                if (parsed?.downloads) return parsed;
            }
        } catch {
            // Cache read failures should not block the request.
        }
    }

    const rapidKey = process.env.RAPIDAPI_KEY;
    const rapidHost = process.env.RAPIDAPI_HOST;

    if (!rapidKey || !rapidHost) {
        throw new Error('RapidAPI credentials are missing');
    }

    const options = {
        method: 'POST',
        url: `https://${rapidHost}/v1/social/autolink`,
        headers: {
            'x-rapidapi-key': rapidKey,
            'x-rapidapi-host': rapidHost,
            'Content-Type': 'application/json',
        },
        data: { url },
    };

    const response = await axios.request(options);
    const cleanData = buildCleanData(response.data || {});

    if (redisClient?.isReady) {
        try {
            await redisClient.set(
                cacheKey,
                JSON.stringify({ cachedAt: new Date().toISOString(), payload: cleanData }),
                { EX: CACHE_TTL_SECONDS }
            );
        } catch {
            // Cache write failures should not block the request.
        }
    }

    return cleanData;
}

module.exports = {
    fetchVideoData,
};
