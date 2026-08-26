import sys
from pathlib import Path

# Ensure ml_service directory is on sys.path for direct imports
ml_service_dir = Path(__file__).resolve().parent.parent
if str(ml_service_dir) not in sys.path:
    sys.path.insert(0, str(ml_service_dir))
