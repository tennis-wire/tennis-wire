package com.tenniswire.discussion_service.repository;

import com.tenniswire.discussion_service.entity.Comment;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    // Keyset rather than offset: a comment written while the reader is on the first page shifts
    // every offset after it, so the second page repeats one comment or skips one, and OFFSET makes
    // the database count the skipped rows on every call. One row beyond the page is asked for so
    // that the caller can tell whether there is more without a second query.
    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
order by created_at, id
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelFirstPage(
            @Param("subjectType") String subjectType, @Param("subjectId") UUID subjectId, @Param("limit") int limit);

    // The pair is compared as a row value so the index is used whole. created_at on its own is not
    // unique - two comments can land in the same microsecond - and would lose one of them or hand
    // it out twice.
    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
  and (created_at, id) > (:afterCreatedAt, :afterId)
order by created_at, id
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelAfter(
            @Param("subjectType") String subjectType,
            @Param("subjectId") UUID subjectId,
            @Param("afterCreatedAt") Instant afterCreatedAt,
            @Param("afterId") UUID afterId,
            @Param("limit") int limit);

    // The three orders the first page can take besides the oldest-first one above. Each is the
    // matching index read one way or the other: idx_comment_top_level for the two by time,
    // idx_comment_top_score for the two by score.
    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
order by created_at desc, id desc
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelNewestFirstPage(
            @Param("subjectType") String subjectType, @Param("subjectId") UUID subjectId, @Param("limit") int limit);

    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
order by score desc, created_at desc, id desc
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelTopFirstPage(
            @Param("subjectType") String subjectType, @Param("subjectId") UUID subjectId, @Param("limit") int limit);

    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
order by score, created_at, id
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelBottomFirstPage(
            @Param("subjectType") String subjectType, @Param("subjectId") UUID subjectId, @Param("limit") int limit);

    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
  and (created_at, id) < (:afterCreatedAt, :afterId)
order by created_at desc, id desc
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelNewestAfter(
            @Param("subjectType") String subjectType,
            @Param("subjectId") UUID subjectId,
            @Param("afterCreatedAt") Instant afterCreatedAt,
            @Param("afterId") UUID afterId,
            @Param("limit") int limit);

    // Row values again, all three columns at once: score alone repeats heavily, and a comment whose
    // score moved between two pages is the reason the client still has to drop what it has seen.
    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
  and (score, created_at, id) < (:afterScore, :afterCreatedAt, :afterId)
order by score desc, created_at desc, id desc
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelTopAfter(
            @Param("subjectType") String subjectType,
            @Param("subjectId") UUID subjectId,
            @Param("afterScore") int afterScore,
            @Param("afterCreatedAt") Instant afterCreatedAt,
            @Param("afterId") UUID afterId,
            @Param("limit") int limit);

    @Query(value = """
select * from comment
where subject_type = :subjectType and subject_id = :subjectId and in_reply_to_id is null
  and (score, created_at, id) > (:afterScore, :afterCreatedAt, :afterId)
order by score, created_at, id
limit :limit
""", nativeQuery = true)
    List<Comment> findTopLevelBottomAfter(
            @Param("subjectType") String subjectType,
            @Param("subjectId") UUID subjectId,
            @Param("afterScore") int afterScore,
            @Param("afterCreatedAt") Instant afterCreatedAt,
            @Param("afterId") UUID afterId,
            @Param("limit") int limit);

    List<Comment> findByRootIdOrderByCreatedAtAscIdAsc(UUID rootId);

    // Ids only: the erase anonymises them in one statement and never needs the rows themselves
    // until the collapse reads them back.
    @Query("select c.id from Comment c where c.authorId = :authorId")
    List<UUID> findIdsByAuthor(@Param("authorId") UUID authorId);

    // Bare ids rather than entities: nothing lands in the persistence context before the tree lock,
    // so the comments read once it is held come from the database.
    @Query("select distinct c.rootId from Comment c where c.id in :ids")
    List<UUID> findRootIdsOf(@Param("ids") Collection<UUID> ids);

    // Held until the transaction ends, and free to take again inside it. Mandatory: outside a
    // transaction the lock would be let go the moment it was taken.
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "select 1 from pg_advisory_xact_lock(:key)", nativeQuery = true)
    int lockTree(@Param("key") long key);

    Optional<Comment> findByAuthorIdAndIdempotencyKey(UUID authorId, UUID idempotencyKey);

    // The two-argument lock is a key space apart from lockTree's single one, so a client's key is
    // never taken for a tree; 1 is this lock's name within it. Held until the transaction ends.
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "select 1 from pg_advisory_xact_lock(1, :key)", nativeQuery = true)
    int lockIdempotencyKey(@Param("key") int key);

    // One text wipe at a time across instances, in the same two-argument key space; 2 is this lock's
    // name. Tried rather than waited for: an instance that finds it taken leaves the work to the one
    // holding it. Held until the transaction ends.
    @Transactional(propagation = Propagation.MANDATORY)
    @Query(value = "select pg_try_advisory_xact_lock(2, 0)", nativeQuery = true)
    boolean tryLockTextExpiry();

    // Depth-capped and budgeted: an unbounded subtree makes the work of one request a property of
    // how far the thread grew, and a depth cap alone does not fix that - a comment with five
    // thousand replies would still have five thousand rows read to hand back twenty.
    //
    // Breadth-first, so the budget spends itself on the levels nearest the head. Ordering by
    // nlevel puts every parent ahead of its children, so a cut can never leave a row whose parent
    // is missing. Width is trimmed afterwards, in the assembly: twenty children a node is not
    // something one statement expresses without window functions.
    @Query(value = """
select * from comment
where path <@ cast(:path as ltree)
  and nlevel(path) <= nlevel(cast(:path as ltree)) + :depth
order by nlevel(path), created_at, id
limit :budget
""", nativeQuery = true)
    List<Comment> findSubtreeToDepth(
            @Param("path") String path, @Param("depth") int depth, @Param("budget") int budget);

    // Direct replies of one comment, paged the same way the top level is: this is what carries a
    // reader past the twentieth reply, and it returns children only - their own subtrees would put
    // the unbounded response back one level down.
    @Query(value = """
select * from comment
where in_reply_to_id = :parentId
order by created_at, id
limit :limit
""", nativeQuery = true)
    List<Comment> findRepliesFirstPage(@Param("parentId") UUID parentId, @Param("limit") int limit);

    @Query(value = """
select * from comment
where in_reply_to_id = :parentId and (created_at, id) > (:afterCreatedAt, :afterId)
order by created_at, id
limit :limit
""", nativeQuery = true)
    List<Comment> findRepliesAfter(
            @Param("parentId") UUID parentId,
            @Param("afterCreatedAt") Instant afterCreatedAt,
            @Param("afterId") UUID afterId,
            @Param("limit") int limit);

    @Query(value = "select * from comment where path @> cast(:path as ltree) order by nlevel(path)", nativeQuery = true)
    List<Comment> findAncestry(@Param("path") String path);

    // Serializes everything that moves a comment's reaction counts: the reaction itself and the
    // removal that sweeps them into the author's total. Taken before the row is read, or the
    // counts in hand are already the ones another writer has just changed. FOR NO KEY UPDATE, so a
    // reply pointing here by foreign key is not held up behind it.
    @Query(value = "SELECT id FROM comment WHERE id = :id FOR NO KEY UPDATE", nativeQuery = true)
    Optional<UUID> lockCounters(@Param("id") UUID id);

    @Modifying
    @Query("update Comment c set c.replyCount = c.replyCount + 1 where c.id = :id")
    int incrementReplyCount(@Param("id") UUID id);

    // By an amount rather than by one: a collapse can take several children of the same surviving
    // parent. Guarded rather than trusted - the count is raw, maintained here alone, and a negative
    // one would show up on the article card.
    @Modifying
    @Query("update Comment c set c.replyCount = c.replyCount - :by where c.id = :id and c.replyCount >= :by")
    int decrementReplyCount(@Param("id") UUID id, @Param("by") int by);

    // Direct children of each of the given comments, gravestones included. Deleted, not living:
    // in_reply_to_id refuses to let a parent go while any row still hangs off it, and after the
    // collapse a childless gravestone no longer exists unless moderation or a report pinned it.
    // The whole set is asked at once so the walk upward costs a fixed number of trips.
    @Query("""
        select new com.tenniswire.discussion_service.repository.ChildTally(
            c.inReplyToId,
            count(c),
            sum(case when c.deletedAt is null or c.replyCount > 0 then 1 else 0 end))
        from Comment c
        where c.inReplyToId in :parentIds
        group by c.inReplyToId
        """)
    List<ChildTally> countChildrenOf(@Param("parentIds") Collection<UUID> parentIds);

    // The same tally over replies by the given authors only: what a viewer who removes them with
    // their branches loses from each count
    @Query("""
        select new com.tenniswire.discussion_service.repository.ChildTally(
            c.inReplyToId,
            count(c),
            sum(case when c.deletedAt is null or c.replyCount > 0 then 1 else 0 end))
        from Comment c
        where c.inReplyToId in :parentIds and c.authorId in :authorIds
        group by c.inReplyToId
        """)
    List<ChildTally> countChildrenByAuthorsAmong(
            @Param("parentIds") Collection<UUID> parentIds, @Param("authorIds") Collection<UUID> authorIds);

    // One statement for the whole collapsed set: the foreign key is checked once it has run, by
    // which time child and parent have gone together. The context is cleared because what it still
    // holds of those rows is no longer in the database.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from Comment c where c.id in :ids")
    int deleteByIdIn(@Param("ids") Collection<UUID> ids);

    // What the erase leaves behind: a node with nothing of its author in it, kept only because
    // something still stands on it. deletedAt is coalesced rather than overwritten so a comment he
    // had already taken down keeps the time he did it.
    // Transactional in its own right: unlike the rest, this one is also called straight from a
    // test, and a repository method on its own runs in Spring Data's read-only transaction.
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        update Comment c
        set c.authorId = null, c.body = null, c.deletedAt = coalesce(c.deletedAt, current_timestamp)
        where c.id in :ids
        """)
    int anonymize(@Param("ids") Collection<UUID> ids);

    // Taken down before the cutoff and still carrying text, oldest first. Ids only: nothing may be in
    // the persistence context before the tree lock.
    @Query("""
        select c.id from Comment c
        where c.deletedAt < :cutoff and c.body is not null
        order by c.deletedAt
        """)
    List<UUID> findTextKeptBefore(@Param("cutoff") Instant cutoff, Pageable page);

    // The same condition once more: the ids were read before their trees were locked, and in between
    // a comment can have lost its text to an erase, or gone.
    @Modifying
    @Query("""
        update Comment c
        set c.body = null
        where c.id in :ids and c.body is not null and c.deletedAt < :cutoff
        """)
    int eraseTextOf(@Param("ids") Collection<UUID> ids, @Param("cutoff") Instant cutoff);

    // Removals and hand-counted violations land in one total. A counted one has no source of its
    // own - only a person counts one - hence the coalesce. The two columns exclude each other.
    @Query("""
        select new com.tenniswire.discussion_service.repository.RemovalTally(
            c.authorId,
            coalesce(c.hiddenSource, 'moderator'),
            count(c),
            sum(case when coalesce(c.hiddenAt, c.countedAt) > :since then 1 else 0 end))
        from Comment c
        where c.authorId in :authorIds and (c.hiddenAt is not null or c.countedAt is not null)
        group by c.authorId, coalesce(c.hiddenSource, 'moderator')
        """)
    List<RemovalTally> countRemovalsAmong(
            @Param("authorIds") Collection<UUID> authorIds, @Param("since") Instant since);

    // current_timestamp, not the JVM clock: compared against updated_at, which a trigger writes.
    @Modifying
    @Query("update Comment c set c.reportsClosedAt = current_timestamp where c.id = :id")
    int markReportsClosed(@Param("id") UUID id);

    @Modifying
    @Query("""
        update Comment c
        set c.reportsClosedAt = current_timestamp, c.countedAt = current_timestamp
        where c.id = :id
        """)
    int markCounted(@Param("id") UUID id);
}
