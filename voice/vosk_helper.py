import argparse
import json
import os
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from vosk import KaldiRecognizer, Model


MODEL_CACHE = {}


def resolve_model_path(model_name: str, model_path: str) -> str:
    if model_path:
        return model_path

    env_default = os.environ.get("BANANZA_VOSK_MODEL_PATH", "").strip()
    if env_default:
        return env_default

    models_dir = os.environ.get("BANANZA_VOSK_MODELS_DIR", "").strip()
    if models_dir and model_name:
        return os.path.join(models_dir, model_name)

    if model_name:
        return model_name

    raise RuntimeError("Vosk model path is not configured")


def get_model(model_name: str, model_path: str) -> tuple[Model, str]:
    resolved = resolve_model_path(model_name, model_path)
    resolved = os.path.abspath(resolved)
    if resolved not in MODEL_CACHE:
        if not os.path.isdir(resolved):
            raise RuntimeError(f"Vosk model directory not found: {resolved}")
        MODEL_CACHE[resolved] = Model(resolved)
    return MODEL_CACHE[resolved], resolved


def transcribe_wav(file_path: str, model_name: str, model_path: str) -> dict:
    if not os.path.isfile(file_path):
        raise RuntimeError(f"Audio file not found: {file_path}")

    model, resolved_model = get_model(model_name, model_path)

    with wave.open(file_path, "rb") as wf:
        if wf.getsampwidth() != 2:
            raise RuntimeError("WAV must be 16-bit PCM")
        if wf.getcomptype() != "NONE":
            raise RuntimeError("Compressed WAV is not supported")

        recognizer = KaldiRecognizer(model, wf.getframerate())
        recognizer.SetWords(False)

        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            recognizer.AcceptWaveform(data)

        result = json.loads(recognizer.FinalResult())
        text = (result.get("text") or "").strip()
        return {
            "text": text,
            "model": os.path.basename(resolved_model),
            "sample_rate": wf.getframerate(),
        }


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/transcribe":
            self._send_json(404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            self._send_json(400, {"error": "Request body is required"})
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            file_path = str(payload.get("file_path") or "").strip()
            model_name = str(payload.get("model_name") or "").strip()
            model_path = str(payload.get("model_path") or "").strip()
            result = transcribe_wav(file_path, model_name, model_path)
            self._send_json(200, result)
        except Exception as error:
            self._send_json(400, {"error": str(error)})

    def log_message(self, *_args):
        return


def main():
    parser = argparse.ArgumentParser(description="Local Vosk HTTP helper for BananZa")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=2700)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Vosk helper listening on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
