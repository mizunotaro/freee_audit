import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_SERVER_ROOT = os.path.dirname(_HERE)
if _SERVER_ROOT not in sys.path:
    sys.path.insert(0, _SERVER_ROOT)
