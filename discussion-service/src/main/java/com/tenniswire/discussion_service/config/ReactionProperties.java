package com.tenniswire.discussion_service.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

// The emoji set, open on purpose: adding or dropping one is a line here, and a key that no longer
// appears simply stops being read out of the stored counts.
@ConfigurationProperties("discussion.reaction")
public record ReactionProperties(List<String> emoji) {}
