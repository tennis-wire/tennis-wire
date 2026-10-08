package com.tenniswire.discussion_service.repository;

import java.util.UUID;

/** One of an author's texts, held up against the one he is about to post. */
public record AuthoredText(UUID id, String body) {}
