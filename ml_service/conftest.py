import sys
from pathlib import Path

# Add ml_service directory to sys.path
ml_dir = Path(__file__).parent
if str(ml_dir) not in sys.path:
    sys.path.insert(0, str(ml_dir))
