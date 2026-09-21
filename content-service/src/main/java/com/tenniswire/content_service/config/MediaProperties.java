package com.tenniswire.content_service.config;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("media")
public record MediaProperties(URI publicBaseUrl, long maxPixels, S3 s3) {

    public record S3(
            URI endpoint, String region, String accessKey, String secretKey, String bucket, boolean pathStyle) {}
}
