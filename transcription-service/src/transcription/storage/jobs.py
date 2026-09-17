"""Job storage using Redis."""

from arq.connections import ArqRedis

from transcription.models import TranscriptionJob

# Job TTL: 24 hours
JOB_TTL_SECONDS = 86400

# The owner index outlives any job it lists; members whose job has expired are dropped on read.
OWNER_INDEX_TTL_SECONDS = 2 * JOB_TTL_SECONDS


class JobStorage:
    """Store and retrieve transcription jobs from Redis."""

    def __init__(self, redis: ArqRedis) -> None:
        self.redis = redis
        self.prefix = "transcription:job:"

    def _key(self, job_id: str) -> str:
        return f"{self.prefix}{job_id}"

    @staticmethod
    def _owner_key(owner_sub: str) -> str:
        return f"transcription:owner:{owner_sub}"

    async def create(self, job: TranscriptionJob) -> None:
        """Save a new job and list it under its owner, newest first."""
        owner_key = self._owner_key(job.owner_sub)
        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.set(self._key(job.id), job.model_dump_json(), ex=JOB_TTL_SECONDS)
            pipe.zadd(owner_key, {job.id: job.created_at.timestamp()})
            pipe.expire(owner_key, OWNER_INDEX_TTL_SECONDS)
            await pipe.execute()

    async def list_for_owner(self, owner_sub: str, limit: int) -> list[TranscriptionJob]:
        """The owner's jobs that still exist, newest first."""
        owner_key = self._owner_key(owner_sub)
        members = await self.redis.zrevrange(owner_key, 0, limit - 1)
        if not members:
            return []

        job_ids = [m.decode() if isinstance(m, bytes) else str(m) for m in members]
        payloads = await self.redis.mget([self._key(job_id) for job_id in job_ids])

        jobs: list[TranscriptionJob] = []
        expired: list[str] = []
        for job_id, payload in zip(job_ids, payloads, strict=True):
            if payload is None:
                expired.append(job_id)
            else:
                jobs.append(TranscriptionJob.model_validate_json(payload))
        if expired:
            await self.redis.zrem(owner_key, *expired)
        return jobs

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
