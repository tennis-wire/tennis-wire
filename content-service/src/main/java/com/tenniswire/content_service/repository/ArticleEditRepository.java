package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.ArticleEdit;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArticleEditRepository extends JpaRepository<ArticleEdit, UUID> {

    Page<ArticleEdit> findByOwnerId(UUID ownerId, Pageable pageable);
}
