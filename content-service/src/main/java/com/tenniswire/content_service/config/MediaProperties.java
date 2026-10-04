package com.tenniswire.content_service.config;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties("media")
public record MediaProperties(URI publicBaseUrl, long maxPixels, S3 s3, Remote remote) {

    // Taking a picture from a link: the same size limit as an upload, a deadline for the whole
    // download, and allowLocal for tests against a server on this machine, never anywhere else
    public record Remote(DataSize maxSize, Duration timeout, boolean allowLocal) {}

    public record S3(
            URI endpoint, String region, String accessKey, String secretKey, String bucket, boolean pathStyle) {}
}
