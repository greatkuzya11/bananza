# Local Whisper provider

BananZa talks directly to the HTTP server shipped with `whisper.cpp`. The provider supports these multilingual models:

- `ggml-tiny.bin`
- `ggml-tiny-q5_1.bin`
- `ggml-base.bin`
- `ggml-base-q5_1.bin`

The selected model is loaded through the local `/load` endpoint before inference, so changing the model in the admin voice settings does not require restarting BananZa.

## Cross-platform installation

Use the same command on Windows, Linux, and macOS:

```bash
npm run whisper:install
```

On supported npm platforms, BananZa uses the optional project-local `ffmpeg-static`
binary automatically. A system FFmpeg remains supported. Set `BANANZA_FFMPEG_PATH`
only when the executable lives outside `PATH` or you need to force a specific build.

The dispatcher detects the operating system:

- Windows x64 downloads the official pinned `whisper.cpp` v1.8.1 CPU release.
- Linux and macOS build the same pinned release locally with one build job by default.
- Every platform downloads the selected GGML model and verifies its SHA-256 checksum.

Linux requires `git`, `cmake`, a C++ compiler, and `ffmpeg`. On Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y git cmake build-essential ffmpeg
npm run whisper:install
```

Start the helper manually on any supported platform with:

```bash
npm run whisper:start
```

Manual startup is optional. When the helper URL is loopback and the installed binary/model are in their default project directories, BananZa starts `whisper-server` on first use. Generated binaries and source checkouts under `voice/whisper-runtime/<platform>-<arch>/` and weights under `voice/models/` are intentionally not committed. Separate platform directories prevent copied Windows artifacts from colliding with a later Linux installation.

The default installation downloads all four selectable models so every admin UI option works immediately. To install only one model, pass `tiny`, `tiny-q5`, `base`, or `base-q5` after `--`.

All installed weights consume disk space only. `whisper-server` keeps just the currently selected model in RAM. Base may take noticeably longer than Tiny to start on a small CPU, so the managed helper allows up to two minutes for model initialization.

For a 2-core/2-GB server, keep `BANANZA_WHISPER_THREADS=1`, `queue_concurrency=1`, and start with `ggml-tiny.bin`.

The helper listens on `127.0.0.1:2701`. Do not expose it to the public network. Its health endpoint is `http://127.0.0.1:2701/health`.

`voice/bananza-whisper.service.example` is a conservative Linux systemd template for the small VPS. Adjust the user and `/opt/bananza` installation path, run the installer first, copy the unit to `/etc/systemd/system/bananza-whisper.service`, then enable it with `systemctl enable --now bananza-whisper`.

## Runtime configuration

The admin voice settings contain the helper URL, selected model, model directory, and language. With the project-local installer, the model directory and `BANANZA_WHISPER_SERVER_BIN` may stay empty: the runtime discovers both platform-specific paths. Set them explicitly only when BananZa and `whisper-server` use different directories or machines.

The GGML weights, `whisper.cpp` binary, optional project-local FFmpeg binary, and service definition are external deployment dependencies and are not included in BananZa backups. Run `npm install` and reinstall Whisper before restoring a server backup.
