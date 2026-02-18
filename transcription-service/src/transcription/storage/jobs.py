"""Job storage using Redis."""

from arq.connections import ArqRedis

from transcription.models import TranscriptionJob

# Job TTL: 24 hours
JOB_TTL_SECONDS = 86400


class JobStorage:
    """Store and retrieve transcription jobs from Redis."""

    def __init__(self, redis: ArqRedis) -> None:
        self.redis = redis
        self.prefix = "transcription:job:"

    def _key(self, job_id: str) -> str:
        return f"{self.prefix}{job_id}"

    async def save(self, job: TranscriptionJob) -> None:
        """Save job to Redis."""
        key = self._key(job.id)
        data = job.model_dump_json()
        await self.redis.set(key, data, ex=JOB_TTL_SECONDS)

    async def get(self, job_id: str) -> TranscriptionJob | None:
        """Get job from Redis."""
        key = self._key(job_id)
        data = await self.redis.get(key)
        if data is None:
            return None
        return TranscriptionJob.model_validate_json(data)

    async def delete(self, job_id: str) -> None:
        """Delete job from Redis."""
        key = self._key(job_id)
        await self.redis.delete(key)

    async def update_status(
        self,
        job_id: str,
        *,
        status: str | None = None,
        progress: int | None = None,
        status_message: str | None = None,
        error: str | None = None,
    ) -> TranscriptionJob | None:
        """Update job status fields."""
        job = await self.get(job_id)
        if job is None:
            return None

        if status is not None:
            job.status = status  # type: ignore[assignment]
        if progress is not None:
            job.progress = progress
        if status_message is not None:
            job.status_message = status_message
        if error is not None:
            job.error = error

        await self.save(job)
        return job
