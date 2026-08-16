#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
models_dir="${BANANZA_WHISPER_MODELS_DIR:-${script_dir}/models}"
model_name="${BANANZA_WHISPER_START_MODEL:-ggml-tiny.bin}"
host="${BANANZA_WHISPER_HOST:-127.0.0.1}"
port="${BANANZA_WHISPER_PORT:-2701}"
threads="${BANANZA_WHISPER_THREADS:-1}"
language="${BANANZA_WHISPER_LANGUAGE:-ru}"

server_bin="${BANANZA_WHISPER_SERVER_BIN:-}"
if [[ -z "${server_bin}" ]]; then
  server_bin="$(command -v whisper-server || true)"
fi
if [[ -z "${server_bin}" ]]; then
  case "$(uname -s)" in
    Linux) runtime_os="linux" ;;
    Darwin) runtime_os="darwin" ;;
    *) runtime_os="" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) runtime_arch="x64" ;;
    arm64|aarch64) runtime_arch="arm64" ;;
    *) runtime_arch="" ;;
  esac
  platform_server="${script_dir}/whisper-runtime/${runtime_os}-${runtime_arch}/build/bin/whisper-server"
  if [[ -n "${runtime_os}" && -n "${runtime_arch}" && -x "${platform_server}" ]]; then
    server_bin="${platform_server}"
  fi
fi
if [[ -z "${server_bin}" && -x "${script_dir}/whisper.cpp/build/bin/whisper-server" ]]; then
  server_bin="${script_dir}/whisper.cpp/build/bin/whisper-server"
fi

if [[ -z "${server_bin}" || ! -x "${server_bin}" ]]; then
  echo "whisper-server was not found. Set BANANZA_WHISPER_SERVER_BIN." >&2
  exit 1
fi
if [[ ! -f "${models_dir}/${model_name}" ]]; then
  echo "Whisper model was not found: ${models_dir}/${model_name}" >&2
  exit 1
fi

cd "${models_dir}"
exec "${server_bin}" \
  --host "${host}" \
  --port "${port}" \
  --threads "${threads}" \
  --processors 1 \
  --language "${language}" \
  --model "${model_name}" \
  --no-gpu \
  --no-language-probabilities
