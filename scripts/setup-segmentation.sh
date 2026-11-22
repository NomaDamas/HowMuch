#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
dir=".howmuch/sam"
mkdir -p "$dir"
python="${PYTHON:-python3}"
# Reuse an installed torch when available; installs are confined to this venv.
"$python" -m venv --system-site-packages "$dir/venv"
p="$dir/venv/bin/python"
export PIP_NO_CACHE_DIR=1 SAM2_BUILD_CUDA=0
"$p" -m pip install 'torch>=2.5.1' 'torchvision>=0.20.1' 'opencv-python-headless>=4.8,<5' wheel setuptools
"$p" -m pip install --no-build-isolation 'SAM-2 @ https://codeload.github.com/facebookresearch/sam2/zip/2b90b9f5ceec907a1c18123530e92e794ad901a4'
file="$dir/sam2.1_hiera_tiny.pt"
if ! test -f "$file"; then
  curl --fail --location --retry 2 'https://huggingface.co/facebook/sam2.1-hiera-tiny/resolve/de431c4043854a71d8101e17995dfe596bf101a5/sam2.1_hiera_tiny.pt' -o "$file.part"
  mv "$file.part" "$file"
fi
"$p" - "$file" <<'PY'
import hashlib, sys
with open(sys.argv[1], "rb") as f:
    digest = hashlib.sha256(f.read()).hexdigest()
if digest != "7402e0d864fa82708a20fbd15bc84245c2f26dff0eb43a4b5b93452deb34be69":
    sys.exit("Checkpoint checksum mismatch. Replace the local checkpoint and rerun setup.")
PY
