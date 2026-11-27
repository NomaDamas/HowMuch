#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
if [[ "${1:-}" == "--detector-only" ]]; then
  mkdir -p .howmuch/sam
  target=.howmuch/sam/nanodet.onnx
  digest=4b82da9944b88577175ee23a459dce2e26e6e4be573def65b1055dc2d9720186
  check() { python3 -c 'import hashlib,sys;sys.exit(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest()!=sys.argv[2])' "$1" "$digest"; }
  if [[ -f "$target" ]] && check "$target"; then exit 0; fi
  curl --fail --location --retry 2 'https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/object_detection_nanodet/object_detection_nanodet_2022nov.onnx' -o "$target.part"
  check "$target.part" && mv "$target.part" "$target"
  exit $?
fi
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

# Higher-quality cut-outs: the large model is used for one-shot segmentation on a GPU (Apple MPS / CUDA).
# Skip with HOWMUCH_SAM_LARGE=0; a plain CPU keeps using the tiny checkpoint either way.
if [[ "${HOWMUCH_SAM_LARGE:-1}" != "0" ]]; then
  big="$dir/sam2.1_hiera_large.pt"
  big_digest=2647878d5dfa5098f2f8649825738a9345572bae2d4350a2468587ece47dd318
  if ! test -f "$big"; then
    curl --fail --location --retry 2 'https://huggingface.co/facebook/sam2.1-hiera-large/resolve/main/sam2.1_hiera_large.pt' -o "$big.part"
    got=$("$p" -c 'import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$big.part")
    if [[ "$got" != "$big_digest" ]]; then rm -f "$big.part"; echo "Large checkpoint checksum mismatch; keeping the tiny model." >&2; else mv "$big.part" "$big"; fi
  fi
fi
