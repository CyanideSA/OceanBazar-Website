package com.oceanbazar.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class OceanBazarApplication {
    public static void main(String[] args) {
        SpringApplication.run(OceanBazarApplication.class, args);
    }
}
