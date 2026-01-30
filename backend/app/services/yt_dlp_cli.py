import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from hashlib import sha256
from typing import Any, Dict, Iterable, List, Optional, Tuple


class YtDlpError(RuntimeError):
    pass


def is_serverless_runtime() -> bool:
    # Common serverless markers.
    keys = [
        "VERCEL",
        "AWS_LAMBDA_FUNCTION_NAME",
        "FUNCTIONS_WORKER_RUNTIME",
        "K_SERVICE",  # Cloud Run
        "NETLIFY",
    ]
    return any(bool((os.getenv(k) or "").strip()) for k in keys)


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _cookies_from_browser_spec() -> str:
    return (os.getenv("YTDLP_COOKIES_FROM_BROWSER") or "").strip()


def _cookies_file_from_env() -> Optional[str]:
    env_cookie_path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
    if env_cookie_path and Path(env_cookie_path).exists():
        return env_cookie_path

    env_cookie_b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
    if not env_cookie_b64:
        return None

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
    tmp.write(base64.b64decode(env_cookie_b64))
    tmp.flush()
    tmp.close()
    return tmp.name


def cookies_env_diagnostics() -> Dict[str, Any]:
    """
    Returns safe diagnostics about the cookies env without leaking cookie values.
    """
    path = (os.getenv("YTDLP_COOKIES_PATH") or "").strip()
    b64 = (os.getenv("YTDLP_COOKIES_B64") or "").strip()
    from_browser = _cookies_from_browser_spec()
    out: Dict[str, Any] = {
        "cookies_path_set": bool(path),
        "cookies_path_exists": bool(path and Path(path).exists()),
        "cookies_b64_set": bool(b64),
        "cookies_from_browser_set": bool(from_browser),
    }
    if from_browser:
        out["cookies_from_browser_hint"] = from_browser.split(":", 1)[0]
    if not b64:
        return out

    try:
        raw = base64.b64decode(b64)
        out["cookies_bytes"] = len(raw)
        out["cookies_sha256_12"] = sha256(raw).hexdigest()[:12]
        head = raw[:64].decode("utf-8", errors="replace")
        out["cookies_head"] = head.replace("\r", "\\r").replace("\n", "\\n")
        out["cookies_looks_netscape"] = ("Netscape HTTP Cookie File" in head) or head.lstrip().startswith("#")
        # Count non-comment lines as a cheap sanity check.
        text = raw.decode("utf-8", errors="replace")
        lines = [ln for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
        out["cookies_rows"] = len(lines)
        out["cookies_has_youtube_domain"] = any(".youtube.com" in ln or "youtube.com" in ln for ln in lines[:2000])
    except Exception as e:
        out["cookies_decode_error"] = str(e)

    return out


def _build_common_cli_args() -> List[str]:
    args: List[str] = [
        "--ignore-config",
        "--no-playlist",
        "--no-warnings",
        "--geo-bypass",
    ]

    proxy = (os.getenv("YTDLP_PROXY") or "").strip()
    if proxy:
        args += ["--proxy", proxy]

    user_agent = (os.getenv("YTDLP_USER_AGENT") or "").strip()
    if user_agent:
        args += ["--user-agent", user_agent]

    referer = (os.getenv("YTDLP_REFERER") or "").strip()
    if referer:
        args += ["--referer", referer]

    # Prefer stable IPv4 in many hosting environments.
    if (os.getenv("YTDLP_FORCE_IPV4") or "").strip().lower() in ("1", "true", "yes"):
        args += ["--force-ipv4"]
    if (os.getenv("YTDLP_FORCE_IPV6") or "").strip().lower() in ("1", "true", "yes"):
        args += ["--force-ipv6"]

    socket_timeout = (os.getenv("YTDLP_SOCKET_TIMEOUT") or "").strip()
    if socket_timeout.isdigit():
        args += ["--socket-timeout", socket_timeout]

    retries = (os.getenv("YTDLP_RETRIES") or "").strip()
    if retries.isdigit():
        args += ["--retries", retries]

    fragment_retries = (os.getenv("YTDLP_FRAGMENT_RETRIES") or "").strip()
    if fragment_retries.isdigit():
        args += ["--fragment-retries", fragment_retries]

    # YouTube: prefer stable clients. This can help in some datacenter environments.
    youtube_clients = (os.getenv("YTDLP_YOUTUBE_CLIENTS") or "web,android").strip()
    if youtube_clients:
        args += ["--extractor-args", f"youtube:player_client={youtube_clients}"]

    return args


def _run_yt_dlp(args: List[str], timeout_s: int) -> Tuple[int, str, str]:
    proc = subprocess.run(
        ["yt-dlp", *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout_s,
    )
    return proc.returncode, proc.stdout, proc.stderr


def dump_json(url: str) -> Dict[str, Any]:
    cookies_tmp: Optional[str] = None
    try:
        cookies = _cookies_file_from_env()
        if cookies and (os.getenv("YTDLP_COOKIES_B64") or "").strip():
            cookies_tmp = cookies
        cookies_from_browser = _cookies_from_browser_spec()

        # Use --dump-json as requested (prints one JSON object per video).
        # With --no-playlist in common args, this should produce exactly one JSON object.
        args = [
            *(_build_common_cli_args()),
            "--skip-download",
            "--dump-json",
        ]
        if cookies:
            args += ["--cookies", cookies]
        elif cookies_from_browser:
            args += ["--cookies-from-browser", cookies_from_browser]

        code, out, err = _run_yt_dlp([*args, url], timeout_s=60)
        if code != 0:
            msg = (err or out or "").strip()
            lowered = msg.lower()
            if "sign in to confirm you’re not a bot" in msg or "sign in to confirm you're not a bot" in msg or "not a bot" in lowered:
                raise YtDlpError(
                    "YouTube requires valid cookies for this request (bot check). "
                    "Update YTDLP_COOKIES_B64 / YTDLP_COOKIES_PATH with fresh exported cookies."
                )
            # Some environments still error on default format selection during metadata extraction.
            # Retry once with an explicit format selector to avoid the default behavior.
            if "requested format is not available" in lowered:
                retry_args = [*args]
                retry_args.insert(retry_args.index("--dump-json"), "-f")
                retry_args.insert(retry_args.index("--dump-json"), "all")
                code2, out2, err2 = _run_yt_dlp([*retry_args, url], timeout_s=60)
                if code2 == 0:
                    out = out2
                    err = err2
                else:
                    msg2 = (err2 or out2 or msg).strip()
                    raise YtDlpError(msg2 or f"yt-dlp failed (exit {code2})")
            else:
                raise YtDlpError(msg or f"yt-dlp failed (exit {code})")
        try:
            # yt-dlp may output multiple lines; take the first JSON object line.
            first = next((ln for ln in (out or "").splitlines() if ln.strip()), "")
            return json.loads(first)
        except Exception as e:
            raise YtDlpError(f"Failed to parse yt-dlp JSON: {e}") from e
    finally:
        if cookies_tmp:
            try:
                os.unlink(cookies_tmp)
            except Exception:
                pass


def _none_if_none_codec(v: Any) -> Optional[str]:
    s = str(v or "").strip()
    if not s or s.lower() == "none":
        return None
    return s


def _to_int(v: Any) -> Optional[int]:
    try:
        if v is None:
            return None
        n = int(float(v))
        return n if n > 0 else None
    except Exception:
        return None


def _to_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        n = float(v)
        return n if n > 0 else None
    except Exception:
        return None


@dataclass(frozen=True)
class NormalizedFormat:
    format_id: str
    container: str
    video_codec: Optional[str]
    audio_codec: Optional[str]
    width: Optional[int]
    height: Optional[int]
    fps: Optional[float]
    vbr: Optional[float]
    abr: Optional[float]
    tbr: Optional[float]
    filesize: Optional[int]
    filesize_approx: Optional[int]

    @property
    def is_video_only(self) -> bool:
        return self.video_codec is not None and self.audio_codec is None

    @property
    def is_audio_only(self) -> bool:
        return self.video_codec is None and self.audio_codec is not None

    @property
    def is_muxed(self) -> bool:
        return self.video_codec is not None and self.audio_codec is not None


def normalize_formats(info: Dict[str, Any]) -> List[NormalizedFormat]:
    out: List[NormalizedFormat] = []
    for f in info.get("formats") or []:
        if not isinstance(f, dict):
            continue
        fid = str(f.get("format_id") or "").strip()
        if not fid:
            continue
        container = str(f.get("ext") or "").strip().lower()
        vcodec = _none_if_none_codec(f.get("vcodec"))
        acodec = _none_if_none_codec(f.get("acodec"))
        out.append(
            NormalizedFormat(
                format_id=fid,
                container=container or "",
                video_codec=vcodec,
                audio_codec=acodec,
                width=_to_int(f.get("width")),
                height=_to_int(f.get("height")),
                fps=_to_float(f.get("fps")),
                vbr=_to_float(f.get("vbr")),
                abr=_to_float(f.get("abr")),
                tbr=_to_float(f.get("tbr")),
                filesize=_to_int(f.get("filesize")),
                filesize_approx=_to_int(f.get("filesize_approx")),
            )
        )
    return out


_FORMAT_TOKEN_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def validate_format_selector(selector: str, available_ids: set[str]) -> List[str]:
    raw = (selector or "").strip()
    if not raw:
        raise YtDlpError("selected_format_id is required")

    lowered = raw.lower()
    # Strictly forbid yt-dlp selector shortcuts and filters.
    forbidden_fragments = ["best", "worst", "[", "]", "/", "(", ")", ",", " "]
    if any(x in lowered for x in forbidden_fragments):
        raise YtDlpError("Format selector is forbidden. Please use real format_id(s) only.")

    parts = raw.split("+")
    if not parts:
        raise YtDlpError("Invalid selected_format_id")

    for p in parts:
        if not _FORMAT_TOKEN_RE.match(p):
            raise YtDlpError(f"Invalid format_id token: {p}")
        if p not in available_ids:
            raise YtDlpError(f"Requested format_id is not available: {p}")

    return parts


def download_to_file(*, url: str, selector: str, out_dir: Path, timeout_s: int = 600) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)

    cookies_tmp: Optional[str] = None
    try:
        cookies = _cookies_file_from_env()
        if cookies and (os.getenv("YTDLP_COOKIES_B64") or "").strip():
            cookies_tmp = cookies
        cookies_from_browser = _cookies_from_browser_spec()

        args: List[str] = [
            *(_build_common_cli_args()),
            "--no-progress",
            "--newline",
            "--restrict-filenames",
            "--paths",
            str(out_dir),
            "-f",
            selector,
            "-o",
            "%(title).80s_%(id)s.%(ext)s",
        ]
        if cookies:
            args += ["--cookies", cookies]
        elif cookies_from_browser:
            args += ["--cookies-from-browser", cookies_from_browser]

        code, out, err = _run_yt_dlp([*args, url], timeout_s=timeout_s)
        if code != 0:
            msg = (err or out or "").strip()
            lowered = msg.lower()
            if "sign in to confirm you’re not a bot" in msg or "sign in to confirm you're not a bot" in msg or "not a bot" in lowered:
                raise YtDlpError(
                    "YouTube requires valid cookies for this download (bot check). "
                    "Update YTDLP_COOKIES_B64 / YTDLP_COOKIES_PATH with fresh exported cookies."
                )
            raise YtDlpError(msg or f"yt-dlp download failed (exit {code})")

        # Pick the newest / largest file as output.
        files = [p for p in out_dir.iterdir() if p.is_file()]
        if not files:
            raise YtDlpError("Download completed but no file was produced.")
        files.sort(key=lambda p: (p.stat().st_size, p.stat().st_mtime), reverse=True)
        return files[0]
    finally:
        if cookies_tmp:
            try:
                os.unlink(cookies_tmp)
            except Exception:
                pass
