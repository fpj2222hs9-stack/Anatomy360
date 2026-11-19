"""Imhotep explainer: grounded explanations baked offline into a shared cache (zero-cost design). See tools/ai/README.md."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # tools/ai
SITE = os.path.dirname(os.path.dirname(ROOT))                           # site root
CACHE_DIR = os.path.join(SITE, 'ai')                                    # the shared cache served with the site
