package com.tenniswire.content_service.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
@EnableConfigurationProperties(MediaProperties.class)
public class MediaStorageConfig {

    @Bean
    S3Client mediaS3Client(MediaProperties properties) {
        var s3 = properties.s3();
        return S3Client.builder()
                .endpointOverride(s3.endpoint())
                .region(Region.of(s3.region()))
                .credentialsProvider(
                        StaticCredentialsProvider.create(AwsBasicCredentials.create(s3.accessKey(), s3.secretKey())))
                .forcePathStyle(s3.pathStyle())
                // The SDK adds a CRC32 trailer by default, an AWS extension that S3-compatible
                // stores handle each in their own way. Production storage is not chosen yet.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }
}
