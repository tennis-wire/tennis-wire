package com.tenniswire.aggregator_service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AggregatorServiceApplicationTests {

    @Test
    void contextLoads() {}
}
