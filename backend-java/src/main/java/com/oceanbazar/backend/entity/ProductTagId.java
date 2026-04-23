package com.oceanbazar.backend.entity;

import lombok.*;
import java.io.Serializable;

@Data @NoArgsConstructor @AllArgsConstructor
public class ProductTagId implements Serializable {
    private String productId;
    private Integer tagId;
}
