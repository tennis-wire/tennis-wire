package com.tenniswire.discussion_service.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("discussion.posting")
public record PostingProperties(
        Duration interval, int hourlyCeiling, int maxLinks, Newcomer newcomer, Duplicate duplicate) {

    public record Newcomer(int standingComments, Duration standingFor, Duration interval) {}

    public record Duplicate(int minLength, Duration elsewhereWithin) {}
}
