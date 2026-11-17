import threading
import time
from collections import deque

MAX_FAILURES = 10
WINDOW_SECONDS = 15 * 60

_failures: deque[float] = deque()
_lock = threading.Lock()


def _prune(now: float) -> None:
    while _failures and now - _failures[0] > WINDOW_SECONDS:
        _failures.popleft()


def seconds_until_allowed() -> int:
    """Return 0 if login is allowed, otherwise how many seconds to wait."""
    now = time.monotonic()
    with _lock:
        _prune(now)
        if len(_failures) < MAX_FAILURES:
            return 0
        return max(1, int(WINDOW_SECONDS - (now - _failures[0])) + 1)


def record_failure() -> None:
    with _lock:
        _failures.append(time.monotonic())


def clear_failures() -> None:
    with _lock:
        _failures.clear()