package com.oceanbazar.backend.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Stable JSON shape for customer inbox; avoids Mongo/Java type quirks on legacy documents.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CustomerNotificationDto {
    private String id;
    private String title;
    private String message;
    /** Optional image URL. */
    private String image;
    private String kind;
    private String entityId;

    /** Unread flag; BSON may use {@code read} or {@code readStatus}. */
    @JsonProperty("read")
    @JsonAlias({"readStatus"})
    private boolean read;

    private Date createdAt;
}
