package com.oceanbazar.backend.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class CategoryResponse {
    private String id;
    private String name;
    private String nameEn;
    private String nameBn;
    private String slug;
    private String icon;
    private String parentId;
    private boolean isLeaf;
    private long count;
    private List<CategoryResponse> children = new ArrayList<>();
}
