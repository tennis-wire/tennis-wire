package com.tenniswire.discussion_service.service;

import java.util.UUID;

// Who is changing a poll: the token's subject, as the poll's created_by is, and whether he may change
// anyone's
public record PollEditor(UUID subject, boolean chiefEditor) {}
