package com.tenniswire.aggregator_service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

// One result per item, in the order they came
public record IngestResponse(List<Result> results) {

    public record Result(String url, Outcome outcome, String reason) {

        public static Result of(String url, Outcome outcome) {
            return new Result(url, outcome, null);
        }
    }

    public enum Outcome {
        @JsonProperty("created")
        CREATED,
        @JsonProperty("updated")
        UPDATED,
        // An update of an item that is not here: it was deleted, and stays so
        @JsonProperty("ignored")
        IGNORED,
        @JsonProperty("rejected")
        REJECTED
    }
}
