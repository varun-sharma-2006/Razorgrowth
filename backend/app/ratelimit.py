import time
from collections import defaultdict, deque
from typing import Deque, Dict
from fastapi import HTTPException


class SlidingWindowLimiter:
    """In-memory per-user limiter. Good enough for one instance; resets on restart."""

    def __init__(self, max_events: int, window_seconds: float):
        self.max_events = max_events
        self.window = window_seconds
        self._events: Dict[str, Deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        events = self._events[key]
        while events and now - events[0] > self.window:
            events.popleft()
        if len(events) >= self.max_events:
            raise HTTPException(status_code=429, detail="Too many new simulations. Try again later.")
        events.append(now)


sandbox_creation_limiter = SlidingWindowLimiter(max_events=30, window_seconds=3600)
