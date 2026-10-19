package com.mandat.api.pack.draw;

import java.security.SecureRandom;
import java.util.random.RandomGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DrawConfig {

    /** Unpredictable source so draws cannot be anticipated from previous results. */
    @Bean
    RandomGenerator drawRandom() {
        return new SecureRandom();
    }
}
