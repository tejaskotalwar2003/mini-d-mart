import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """In-memory sliding window rate limiter per client IP address.

    Tracks timestamps of incoming requests per IP and rejects requests
    exceeding `requests_limit` within `window_seconds`.
    """

    def __init__(self, requests_limit: int = 5, window_seconds: int = 60):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self._records: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "127.0.0.1"

    async def __call__(self, request: Request) -> None:
        client_ip = self._get_client_ip(request)
        now = time.time()

        # Evict timestamps older than the sliding window
        timestamps = [ts for ts in self._records[client_ip] if now - ts < self.window_seconds]
        self._records[client_ip] = timestamps

        if len(timestamps) >= self.requests_limit:
            oldest = timestamps[0]
            retry_after = int(self.window_seconds - (now - oldest)) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many authentication attempts. Please try again later.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self._records[client_ip].append(now)

    def reset(self) -> None:
        """Reset internal IP history (useful during testing)."""
        self._records.clear()


auth_rate_limiter = InMemoryRateLimiter(requests_limit=5, window_seconds=60)
