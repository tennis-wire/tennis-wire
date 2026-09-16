package com.tenniswire.discussion_service.service;

import com.tenniswire.discussion_service.entity.Block;
import java.util.List;
import org.jspecify.annotations.Nullable;

public record BlockPage(List<Block> items, @Nullable String nextCursor) {}
