package com.tenniswire.discussion_service.service;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record CommentPage(List<CommentView> items, @Nullable String nextCursor) {}
