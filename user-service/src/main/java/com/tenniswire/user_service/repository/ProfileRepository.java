package com.tenniswire.user_service.repository;

import com.tenniswire.user_service.entity.Profile;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Profile p where p.userId = :userId")
    Optional<Profile> lock(@Param("userId") UUID userId);

    @Modifying
    @Query("""
            update Profile p
            set p.avatarKey = :avatarKey, p.avatarUpdatedAt = current_timestamp
            where p.userId = :userId
            """)
    int setAvatar(@Param("userId") UUID userId, @Param("avatarKey") @Nullable String avatarKey);

    // The predicate is the partial index's, word for word
    @Query(value = """
            select * from profile
            where avatar_key is not null
              and (avatar_reviewed_at is null or avatar_reviewed_at < avatar_updated_at)
            order by avatar_updated_at, user_id
            limit :size
            """, nativeQuery = true)
    List<Profile> avatarsToReview(@Param("size") int size);

    // Only the avatar the moderator saw: one uploaded since is not passed along with it
    @Modifying
    @Query("""
            update Profile p
            set p.avatarReviewedAt = current_timestamp
            where p.userId = :userId and p.avatarKey = :avatarKey
            """)
    int markAvatarReviewed(@Param("userId") UUID userId, @Param("avatarKey") String avatarKey);
}
