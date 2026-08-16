#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
models_dir="${BANANZA_WHISPER_MODELS_DIR:-${script_dir}/models}"
selection="${1:-all}"
base_url="https://huggingface.co/ggerganov/whisper.cpp/resolve/main"

expected_sha256() {
  case "$1" in
    ggml-tiny.bin) echo "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21" ;;
    ggml-tiny-q5_1.bin) echo "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7" ;;
    ggml-base.bin) echo "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe" ;;
    ggml-base-q5_1.bin) echo "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898" ;;
    *) return 1 ;;
  esac
}

verify_model() {
  local target="$1"
  local expected="$2"
  local actual=""
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${target}" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "${target}" | awk '{print $1}')"
  else
    echo "sha256sum or shasum is required to verify Whisper models" >&2
    return 1
  fi
  if [[ "${actual}" != "${expected}" ]]; then
    echo "Checksum mismatch for ${target}" >&2
    return 1
  fi
}

case "${selection}" in
  tiny) models=(ggml-tiny.bin) ;;
  tiny-q5) models=(ggml-tiny-q5_1.bin) ;;
  base) models=(ggml-base.bin) ;;
  base-q5) models=(ggml-base-q5_1.bin) ;;
  all) models=(ggml-tiny.bin ggml-tiny-q5_1.bin ggml-base.bin ggml-base-q5_1.bin) ;;
  *) echo "Usage: $0 [tiny|tiny-q5|base|base-q5|all]" >&2; exit 2 ;;
esac

mkdir -p "${models_dir}"
for model in "${models[@]}"; do
  target="${models_dir}/${model}"
  expected="$(expected_sha256 "${model}")"
  if [[ -s "${target}" ]]; then
    verify_model "${target}" "${expected}"
    echo "Already downloaded: ${target}"
    continue
  fi
  echo "Downloading ${model}"
  curl --fail --location --retry 3 --output "${target}.part" "${base_url}/${model}?download=true"
  verify_model "${target}.part" "${expected}"
  mv "${target}.part" "${target}"
done
