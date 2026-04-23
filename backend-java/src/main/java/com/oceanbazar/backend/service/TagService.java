package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.CatalogDtos.*;
import com.oceanbazar.backend.entity.*;
import com.oceanbazar.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagService {
    private final TagGroupRepository tagGroupRepository;
    private final TagRepository tagRepository;
    private final ProductTagRepository productTagRepository;

    public List<TagGroupDto> listGroups() {
        return tagGroupRepository.findAll(org.springframework.data.domain.Sort.by("sortOrder")).stream()
                .map(this::toGroupDto)
                .collect(Collectors.toList());
    }

    public TagGroupDto createGroup(TagGroupRequest req) {
        String slug = toSlug(req.getNameEn());
        if (tagGroupRepository.existsBySlug(slug)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tag group slug already exists");
        }
        TagGroupEntity entity = new TagGroupEntity();
        entity.setNameEn(req.getNameEn().trim());
        entity.setNameBn(req.getNameBn() != null ? req.getNameBn().trim() : req.getNameEn().trim());
        entity.setSlug(slug);
        entity.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        return toGroupDto(tagGroupRepository.save(entity));
    }

    public TagGroupDto updateGroup(Integer id, TagGroupRequest req) {
        TagGroupEntity entity = tagGroupRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag group not found"));
        if (req.getNameEn() != null) entity.setNameEn(req.getNameEn().trim());
        if (req.getNameBn() != null) entity.setNameBn(req.getNameBn().trim());
        if (req.getSortOrder() != null) entity.setSortOrder(req.getSortOrder());
        return toGroupDto(tagGroupRepository.save(entity));
    }

    public void deleteGroup(Integer id) {
        tagGroupRepository.deleteById(id);
    }

    public TagDto createTag(TagRequest req) {
        String slug = toSlug(req.getNameEn());
        if (tagRepository.existsBySlug(slug)) {
            // Append random suffix
            slug = slug + "-" + UUID.randomUUID().toString().substring(0, 4);
        }
        TagEntity entity = new TagEntity();
        entity.setGroupId(req.getGroupId());
        entity.setNameEn(req.getNameEn().trim());
        entity.setNameBn(req.getNameBn() != null ? req.getNameBn().trim() : req.getNameEn().trim());
        entity.setSlug(slug);
        entity.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        TagEntity saved = tagRepository.save(entity);
        return toTagDto(saved);
    }

    public TagDto updateTag(Integer id, TagRequest req) {
        TagEntity entity = tagRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag not found"));
        if (req.getNameEn() != null) entity.setNameEn(req.getNameEn().trim());
        if (req.getNameBn() != null) entity.setNameBn(req.getNameBn().trim());
        if (req.getGroupId() != null) entity.setGroupId(req.getGroupId());
        if (req.getSortOrder() != null) entity.setSortOrder(req.getSortOrder());
        return toTagDto(tagRepository.save(entity));
    }

    public void deleteTag(Integer id) {
        tagRepository.deleteById(id);
    }

    /** Link tags to a product (replaces existing) */
    @Transactional
    public void setProductTags(String productId, List<Integer> tagIds) {
        productTagRepository.deleteByProductId(productId);
        if (tagIds != null) {
            for (Integer tagId : tagIds) {
                productTagRepository.save(new ProductTagEntity(productId, tagId));
            }
        }
    }

    public List<TagDto> getProductTags(String productId) {
        return productTagRepository.findByProductId(productId).stream()
                .map(pt -> tagRepository.findById(pt.getTagId()).orElse(null))
                .filter(Objects::nonNull)
                .map(this::toTagDto)
                .collect(Collectors.toList());
    }

    private TagGroupDto toGroupDto(TagGroupEntity entity) {
        List<TagDto> tags = entity.getTags() != null
                ? entity.getTags().stream().map(this::toTagDto).collect(Collectors.toList())
                : tagRepository.findByGroupIdOrderBySortOrderAsc(entity.getId()).stream().map(this::toTagDto).collect(Collectors.toList());
        return TagGroupDto.builder()
                .id(entity.getId())
                .nameEn(entity.getNameEn())
                .nameBn(entity.getNameBn())
                .slug(entity.getSlug())
                .sortOrder(entity.getSortOrder())
                .tags(tags)
                .build();
    }

    private TagDto toTagDto(TagEntity entity) {
        String groupName = null;
        if (entity.getGroupId() != null) {
            groupName = tagGroupRepository.findById(entity.getGroupId())
                    .map(TagGroupEntity::getNameEn)
                    .orElse(null);
        }
        return TagDto.builder()
                .id(entity.getId())
                .nameEn(entity.getNameEn())
                .nameBn(entity.getNameBn())
                .slug(entity.getSlug())
                .groupName(groupName)
                .build();
    }

    private String toSlug(String name) {
        return name.toLowerCase()
                .replaceAll("[^a-z0-9\\s]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }
}
