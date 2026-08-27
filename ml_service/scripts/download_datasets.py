"""
VoiceShield - Dataset & Pre-trained Model Downloader Utility
------------------------------------------------------------
Provides automated catalog and download helpers for:
1. In-The-Wild Audio Deepfake Dataset (~1.4 GB)
2. WaveFake Dataset (~5.8 GB)
3. ASVspoof 2019 / 2021 Datasets (~15 - 35 GB)
4. Pre-trained HuggingFace Model Weights (WavLM Base+, SpeechBrain ECAPA-TDNN)
"""

import os
import sys
import argparse
import urllib.request
import json
from pathlib import Path

# Registry of dataset metadata and direct download endpoints
DATASET_REGISTRY = {
    "in-the-wild": {
        "name": "In-the-Wild Audio Deepfake Dataset (Interspeech 2022)",
        "description": "58 celebrities/executives, 38 hours of genuine & deepfake audio from real-world podcasts & videos.",
        "size": "~1.4 GB",
        "huggingface_id": "mueller91/In-The-Wild",
        "huggingface_url": "https://huggingface.co/datasets/mueller91/In-The-Wild",
        "official_url": "https://deepfake-total.com/in_the_wild",
        "zenodo_url": "https://zenodo.org/records/7594957",
        "kaggle_url": "https://www.kaggle.com/datasets/thedevastator/release-in-the-wild-audio-deepfake"
    },
    "wavefake": {
        "name": "WaveFake Dataset (NeurIPS 2021 Datasets & Benchmarks)",
        "description": "104,885 audio clips generated across 6 neural vocoders (MelGAN, HiFi-GAN, WaveGlow, Parallel WaveGAN, etc.).",
        "size": "~5.8 GB",
        "huggingface_id": "ajaykarthick/wavefake-audio",
        "huggingface_url": "https://huggingface.co/datasets/ajaykarthick/wavefake-audio",
        "zenodo_url": "https://zenodo.org/records/5642694",
        "github_url": "https://github.com/RUB-SysSec/WaveFake"
    },
    "asvspoof2019": {
        "name": "ASVspoof 2019 (Logical Access - LA Track)",
        "description": "Gold standard benchmark with 107k+ human and TTS/VC spoofed utterances across 19 algorithms.",
        "size": "~15.0 GB",
        "huggingface_id": "SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA",
        "huggingface_url": "https://huggingface.co/datasets/SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA",
        "official_url": "https://www.asvspoof.org/index2019.html",
        "edinburgh_datashare": "https://datashare.ed.ac.uk/handle/10283/3336"
    },
    "asvspoof2021": {
        "name": "ASVspoof 2021 (Deepfake Track - DF & LA)",
        "description": "Audio with transmission loss, telephony codecs (VoIP, lossy m4a/opus/mp3), and modern synthesis.",
        "size": "~35.0 GB",
        "official_url": "https://www.asvspoof.org/index2021.html",
        "zenodo_df": "https://zenodo.org/record/4835108",
        "zenodo_la": "https://zenodo.org/record/4837263",
        "zenodo_pa": "https://zenodo.org/record/4834716"
    }
}

MODEL_REGISTRY = {
    "wavlm-base-plus": {
        "repo_id": "microsoft/wavlm-base-plus",
        "type": "backbone",
        "description": "Microsoft WavLM Base+ 94M-parameter self-supervised speech backbone.",
        "url": "https://huggingface.co/microsoft/wavlm-base-plus"
    },
    "wavlm-deepfake-detector": {
        "repo_id": "HamidRezaAttar/wavlm-base-plus-deepfake-audio-detection",
        "type": "classifier",
        "description": "Pre-trained WavLM fine-tuned for binary audio deepfake / synthetic speech detection.",
        "url": "https://huggingface.co/HamidRezaAttar/wavlm-base-plus-deepfake-audio-detection"
    },
    "ecapa-voxceleb": {
        "repo_id": "speechbrain/spkrec-ecapa-voxceleb",
        "type": "speaker_verification",
        "description": "SpeechBrain ECAPA-TDNN 192-dimensional speaker verification model trained on VoxCeleb 1 & 2.",
        "url": "https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb"
    }
}


def print_dataset_catalog():
    print("=" * 80)
    print("VOICESHIELD ML DATASET CATALOG & SOURCES")
    print("=" * 80)
    for key, info in DATASET_REGISTRY.items():
        print(f"\n[{key.upper()}] - {info['name']}")
        print(f"  Description : {info['description']}")
        print(f"  Approx Size : {info['size']}")
        if "huggingface_url" in info:
            print(f"  HuggingFace : {info['huggingface_url']} (ID: {info.get('huggingface_id')})")
        if "official_url" in info:
            print(f"  Official    : {info['official_url']}")
        if "zenodo_url" in info:
            print(f"  Zenodo      : {info['zenodo_url']}")
        if "zenodo_df" in info:
            print(f"  Zenodo DF   : {info['zenodo_df']}")
            print(f"  Zenodo LA   : {info['zenodo_la']}")
        if "github_url" in info:
            print(f"  GitHub      : {info['github_url']}")
    
    print("\n" + "=" * 80)
    print("PRE-TRAINED MODEL CHECKPOINTS (HUGGING FACE)")
    print("=" * 80)
    for key, info in MODEL_REGISTRY.items():
        print(f"\n[{key}]")
        print(f"  HuggingFace Repo ID : {info['repo_id']}")
        print(f"  Type                : {info['type']}")
        print(f"  Description         : {info['description']}")
        print(f"  URL                 : {info['url']}")
    print("=" * 80)


def download_pretrained_models():
    """Pulls and caches the Hugging Face model weights locally."""
    print("\n[+] Downloading and caching pre-trained models via Hugging Face...")
    
    # 1. Download WavLM Feature Extractor & Model
    try:
        # pyrefly: ignore [missing-import]
        from transformers import AutoFeatureExtractor, WavLMModel
        print(f"--> Pulling {MODEL_REGISTRY['wavlm-base-plus']['repo_id']}...")
        AutoFeatureExtractor.from_pretrained(MODEL_REGISTRY['wavlm-base-plus']['repo_id'])
        WavLMModel.from_pretrained(MODEL_REGISTRY['wavlm-base-plus']['repo_id'])
        print("[OK] Microsoft WavLM Base+ cached successfully.")
    except Exception as e:
        print(f"[!] Note on WavLM download: {e}")

    # 2. Download ECAPA-TDNN Speaker Verification Model
    try:
        # pyrefly: ignore [missing-import]
        from speechbrain.inference.speaker import EncoderClassifier
        print(f"--> Pulling {MODEL_REGISTRY['ecapa-voxceleb']['repo_id']}...")
        savedir = Path("ml_service/models_cache/ecapa")
        savedir.mkdir(parents=True, exist_ok=True)
        EncoderClassifier.from_hparams(
            source=MODEL_REGISTRY['ecapa-voxceleb']['repo_id'],
            savedir=str(savedir)
        )
        print("[OK] SpeechBrain ECAPA-TDNN cached successfully.")
    except Exception as e:
        print(f"[!] Note on SpeechBrain download: {e}")


def main():
    parser = argparse.ArgumentParser(description="VoiceShield Dataset & Model Downloader")
    parser.add_argument("--list", action="store_true", help="List all dataset and model sources with direct URLs")
    parser.add_argument("--download-models", action="store_true", help="Download pre-trained WavLM and ECAPA-TDNN checkpoints")
    parser.add_argument("--dataset", type=str, choices=["in-the-wild", "wavefake", "asvspoof2019", "asvspoof2021", "all"],
                        help="Select dataset to view download instructions or stream via datasets library")
    
    args = parser.parse_args()

    if args.list or (not args.download_models and not args.dataset):
        print_dataset_catalog()
        print("\nQuick Python Snippet to stream/load datasets directly:")
        print("---------------------------------------------------------")
        print("from datasets import load_dataset")
        print("# Load In-The-Wild (streaming mode = 0 disk space):")
        print("ds_wild = load_dataset('mueller91/In-The-Wild', split='test', streaming=True)")
        print("# Load ASVSpoof 2019 LA:")
        print("ds_asv = load_dataset('SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA', split='test', streaming=True)")
        print("# Load WaveFake:")
        print("ds_wavefake = load_dataset('ajaykarthick/wavefake-audio', split='train', streaming=True)")
        print("---------------------------------------------------------\n")
        return

    if args.download_models:
        download_pretrained_models()

    if args.dataset:
        key = args.dataset
        if key in DATASET_REGISTRY:
            info = DATASET_REGISTRY[key]
            print(f"\n[+] Dataset: {info['name']}")
            print(f"    Size: {info['size']}")
            if "huggingface_id" in info:
                print(f"    HF ID: {info['huggingface_id']}")
                print(f"    Python Code: load_dataset('{info['huggingface_id']}')")
            if "zenodo_url" in info:
                print(f"    Direct Download: {info['zenodo_url']}")


if __name__ == "__main__":
    main()
