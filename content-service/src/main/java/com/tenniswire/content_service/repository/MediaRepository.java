package com.tenniswire.content_service.repository;

import com.tenniswire.content_service.entity.Media;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaRepository extends JpaRepository<Media, UUID> {}
