import math
from datetime import date, timedelta
from typing import Literal

Rating = Literal["again", "good", "easy"]

MIN_EASE = 1.3
MAX_EASE = 3.0
EASY_BONUS = 1.3


def schedule(
    rating: Rating, ease: float, interval_days: int, today: date
) -> tuple[float, int, date]:
    if rating == "again":
        ease = max(MIN_EASE, ease - 0.2)
        interval = 1
    elif rating == "good":
        if interval_days == 0:
            interval = 1
        else:
            interval = max(interval_days + 1, math.ceil(interval_days * ease))
    else:  # easy
        ease = min(MAX_EASE, ease + 0.15)
        base = max(interval_days, 1)
        interval = max(interval_days + 1, math.ceil(base * ease * EASY_BONUS))

    return round(ease, 2), interval, today + timedelta(days=interval)