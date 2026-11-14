package com.tenniswire.discussion_service.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

// The emoji set, open on purpose: adding or dropping one is a line here and one in each client's
// table. A dropped key is refused on write; what is stored under it is still read out as it is, and
// the clients, which draw only the keys they know, leave it unshown.
@ConfigurationProperties("discussion.reaction")
public record ReactionProperties(List<String> emoji) {}
