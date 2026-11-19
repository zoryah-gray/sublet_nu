"""Puts Lambda source folders on sys.path, mirroring /var/task (function code) and /opt/python (layer)."""
import pathlib
import sys

FUNCTIONS = pathlib.Path(__file__).resolve().parents[1] / 'functions'
sys.path[:0] = [str(FUNCTIONS / 'auth'), str(FUNCTIONS / 'layer' / 'python')]
