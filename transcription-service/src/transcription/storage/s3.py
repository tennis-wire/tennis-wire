"""S3-compatible storage client."""

import asyncio
from pathlib import Path
from typing import IO, Any

import boto3
from botocore.config import Config

from transcription.config import Settings


class S3Storage:
    """S3-compatible storage for media files and results."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.bucket = settings.s3_bucket_name

        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )

    async def upload_file(
        self,
        file: IO[bytes],
        key: str,
        content_type: str | None = None,
    ) -> str:
        """Upload file to S3."""
        extra_args: dict[str, Any] = {}
        if content_type:
            extra_args["ContentType"] = content_type

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.upload_fileobj(file, self.bucket, key, ExtraArgs=extra_args),
        )
        return key

    async def upload_from_path(self, path: Path, key: str) -> str:
        """Upload file from local path to S3."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.upload_file(str(path), self.bucket, key),
        )
        return key

    async def download_file(self, key: str, destination: Path) -> Path:
        """Download file from S3 to local path."""
        destination.parent.mkdir(parents=True, exist_ok=True)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.download_file(self.bucket, key, str(destination)),
        )
        return destination

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate pre-signed URL for downloading."""
        loop = asyncio.get_event_loop()
        url: str = await loop.run_in_executor(
            None,
            lambda: self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
            ),
        )
        return url

    async def delete_file(self, key: str) -> None:
        """Delete file from S3."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._client.delete_object(Bucket=self.bucket, Key=key),
        )

    async def file_exists(self, key: str) -> bool:
        """Check if file exists in S3."""
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: self._client.head_object(Bucket=self.bucket, Key=key),
            )
            return True
        except self._client.exceptions.ClientError:
            return False
