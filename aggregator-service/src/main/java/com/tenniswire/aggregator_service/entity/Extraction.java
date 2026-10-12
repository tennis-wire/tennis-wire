package com.tenniswire.aggregator_service.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Locale;

// The collector's word for what became of the article page (aggregator.md 4.4)
public enum Extraction {
    @JsonProperty("ok")
    OK,
    // The page could not be had or read: the lead from the feed stays
    @JsonProperty("failed")
    FAILED,
    // Not attempted: a lead-only source, or robots.txt
    @JsonProperty("skipped")
    SKIPPED;

    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }
}
