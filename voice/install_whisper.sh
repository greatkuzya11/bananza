#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
release="v1.8.1"
selection="${1:-all}"
case "$(uname -s)" in
  Linux) runtime_os="linux" ;;
  Darwin) runtime_os="darwin" ;;
  *) echo "Unsupported operating system: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) runtime_arch="x64" ;;
  arm64|aarch64) runtime_arch="arm64" ;;
  *) echo "Unsupported CPU architecture: $(uname -m)" >&2; exit 1 ;;
esac

runtime_root="${script_dir}/whisper-runtime"
source_dir="${runtime_root}/source-${release}"
build_dir="${runtime_root}/${runtime_os}-${runtime_arch}/build"
server_bin="${build_dir}/bin/whisper-server"

case "${selection}" in
  tiny|tiny-q5|base|base-q5|all) ;;
  *) echo "Usage: $0 [tiny|tiny-q5|base|base-q5|all]" >&2; exit 2 ;;
esac

if [[ ! -x "${server_bin}" ]]; then
  for dependency in git cmake c++; do
    if ! command -v "${dependency}" >/dev/null 2>&1; then
      echo "Missing build dependency: ${dependency}. On Debian/Ubuntu run: sudo apt install git cmake build-essential" >&2
      exit 1
    fi
  done

  if [[ ! -d "${source_dir}/.git" ]]; then
    if [[ -e "${source_dir}" ]]; then
      echo "${source_dir} exists but is not a whisper.cpp git checkout. Move it away and retry." >&2
      exit 1
    fi
    git clone --depth 1 --branch "${release}" https://github.com/ggml-org/whisper.cpp.git "${source_dir}"
  else
    installed_release="$(git -C "${source_dir}" describe --tags --exact-match 2>/dev/null || true)"
    if [[ "${installed_release}" != "${release}" ]]; then
      echo "${source_dir} is checked out at '${installed_release:-an untagged revision}', expected ${release}." >&2
      exit 1
    fi
  fi

  cmake -S "${source_dir}" -B "${build_dir}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DWHISPER_BUILD_TESTS=OFF \
    -DWHISPER_BUILD_EXAMPLES=ON
  cmake --build "${build_dir}" --config Release \
    --parallel "${BANANZA_WHISPER_BUILD_JOBS:-1}" \
    --target whisper-server
else
  echo "Already installed: ${server_bin}"
fi

bash "${script_dir}/download_whisper_models.sh" "${selection}"
if [[ ! -x "${server_bin}" ]]; then
  echo "Whisper installation failed: ${server_bin}" >&2
  exit 1
fi

echo "Whisper is installed. BananZa can auto-start it when the provider is used."
