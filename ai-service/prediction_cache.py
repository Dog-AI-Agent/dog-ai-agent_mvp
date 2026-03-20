"""
Prediction Cache — Thread-safe LRU cache with TTL for detection + classification results.
"""
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Optional


@dataclass(slots=True)
class DetectionResult:
    is_dog: bool
    confidence: float
    top_class_index: int


@dataclass(slots=True)
class ClassificationResult:
    breed_en: str
    breed_ko: str
    size: str
    confidence: float
    top3: list[dict] = field(default_factory=list)


@dataclass(slots=True)
class CachedPrediction:
    image_hash: str
    detection: DetectionResult
    classification: Optional[ClassificationResult]
    inference_time_ms: float
    timestamp: float


class PredictionCache:
    def __init__(self, maxsize: int = 128, ttl: float = 300.0) -> None:
        self._maxsize = maxsize
        self._ttl = ttl
        self._cache: OrderedDict[str, CachedPrediction] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, image_hash: str) -> Optional[CachedPrediction]:
        with self._lock:
            entry = self._cache.get(image_hash)
            if entry is None:
                return None
            if (time.time() - entry.timestamp) > self._ttl:
                del self._cache[image_hash]
                return None
            self._cache.move_to_end(image_hash)
            return entry

    def set(self, image_hash: str, result: CachedPrediction) -> None:
        with self._lock:
            if image_hash in self._cache:
                self._cache[image_hash] = result
                self._cache.move_to_end(image_hash)
            else:
                if len(self._cache) >= self._maxsize:
                    self._cache.popitem(last=False)
                self._cache[image_hash] = result

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._cache)


# Module-level singleton
prediction_cache = PredictionCache(maxsize=128, ttl=300.0)
