package com.tenniswire.discussion_service;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;

// Two writers on the same rows, in a fixed order. The first stops inside its transaction, wherever
// the test's spy calls stopTheFirst(); the second starts, and the first is let go once the second
// has finished or is waiting on a lock. Any lock counts: a row when the code under test takes no
// lock of its own, an advisory lock when it does. The first writer cannot be the one waiting, it is
// stopped in Java rather than in the database.
//
// One race per instance.
public final class TwoWriters {

    public static final Duration PATIENCE = Duration.ofSeconds(10);

    private static final String WAITING_ON_A_LOCK = """
            select count(*) from pg_stat_activity
            where datname = current_database() and backend_type = 'client backend' and wait_event_type = 'Lock'
            """;

    private final JdbcTemplate jdbc;
    private final AtomicBoolean armed = new AtomicBoolean();
    private final CountDownLatch stopped = new CountDownLatch(1);
    private final CountDownLatch released = new CountDownLatch(1);

    public TwoWriters(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    // For the spy. Only the first call once the race has started stops: fixtures pass the same point
    // before it, and the second writer after.
    public void stopTheFirst() throws InterruptedException {
        if (armed.compareAndSet(true, false)) {
            stopped.countDown();
            if (!released.await(PATIENCE.toSeconds(), SECONDS)) {
                throw new IllegalStateException("The first writer was never let go");
            }
        }
    }

    // Both writers are done by the time the second one's future comes back
    public Future<?> race(Runnable first, Runnable second) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            try {
                armed.set(true);
                var early = pool.submit(first);
                assertThat(stopped.await(PATIENCE.toSeconds(), SECONDS)).isTrue();
                var late = pool.submit(second);
                awaitDoneOrWaiting(late);
                released.countDown();
                early.get(PATIENCE.toSeconds(), SECONDS);
                return late;
            } finally {
                released.countDown();
            }
        }
    }

    private void awaitDoneOrWaiting(Future<?> late) throws InterruptedException {
        var deadline = Instant.now().plus(PATIENCE);
        while (!late.isDone()) {
            var waiting = jdbc.queryForObject(WAITING_ON_A_LOCK, Long.class);
            if (waiting != null && waiting > 0) {
                return;
            }
            assertThat(Instant.now())
                    .as("the second writer neither finished nor waited")
                    .isBefore(deadline);
            Thread.sleep(20);
        }
    }
}
