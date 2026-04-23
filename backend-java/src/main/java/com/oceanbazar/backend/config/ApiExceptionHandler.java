package com.oceanbazar.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        String detail = ex.getReason() == null ? "Request failed" : ex.getReason();
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of(
                        "success", false,
                        "detail", detail,
                        "error", Map.of(
                                "code", ex.getStatusCode().toString(),
                                "message", detail
                        )
                ));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        log.warn("Malformed JSON body: {}", ex.getMessage());
        String detail = "Invalid or empty JSON body";
        if (ex.getMessage() != null && ex.getMessage().length() < 200) {
            detail = "Invalid request body: " + ex.getMessage();
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of(
                        "success", false,
                        "detail", detail,
                        "error", Map.of(
                                "code", HttpStatus.BAD_REQUEST.toString(),
                                "message", detail
                        )
                ));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccess(DataAccessException ex) {
        log.error("Database error", ex);
        String detail = "Could not persist data. Please try again.";
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "success", false,
                        "detail", detail,
                        "error", Map.of(
                                "code", HttpStatus.INTERNAL_SERVER_ERROR.toString(),
                                "message", detail
                        )
                ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        var errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of(
                        "field", fe.getField(),
                        "message", fe.getDefaultMessage() == null ? "Invalid value" : fe.getDefaultMessage()
                ))
                .collect(Collectors.toList());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of(
                        "success", false,
                        "detail", "Invalid request payload",
                        "errors", errors,
                        "error", Map.of(
                                "code", HttpStatus.BAD_REQUEST.toString(),
                                "message", "Invalid request payload"
                        )
                ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                        "success", false,
                        "detail", "Internal server error",
                        "error", Map.of(
                                "code", HttpStatus.INTERNAL_SERVER_ERROR.toString(),
                                "message", "Internal server error"
                        )
                ));
    }
}
