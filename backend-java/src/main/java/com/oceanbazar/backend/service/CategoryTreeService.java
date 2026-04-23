package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.CatalogDtos.*;
import com.oceanbazar.backend.entity.CategoryEntity;
import com.oceanbazar.backend.repository.CategoryRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.utils.ShortId;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryTreeService {
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    /** Build full tree from flat list. */
    public List<CategoryTreeNode> buildTree() {
        List<CategoryEntity> all = categoryRepository.findAllOrderedForTree();
        Map<String, List<CategoryEntity>> childrenMap = all.stream()
                .filter(c -> c.getParentId() != null)
                .collect(Collectors.groupingBy(CategoryEntity::getParentId));

        List<CategoryEntity> roots = all.stream()
                .filter(c -> c.getParentId() == null)
                .collect(Collectors.toList());

        return roots.stream().map(r -> buildNode(r, childrenMap)).collect(Collectors.toList());
    }

    private CategoryTreeNode buildNode(CategoryEntity entity, Map<String, List<CategoryEntity>> childrenMap) {
        List<CategoryEntity> kids = childrenMap.getOrDefault(entity.getId(), Collections.emptyList());
        List<CategoryTreeNode> childNodes = kids.stream()
                .map(k -> buildNode(k, childrenMap))
                .collect(Collectors.toList());

        long prodCount = productRepository.countByCategoryId(entity.getId());

        return CategoryTreeNode.builder()
                .id(entity.getId())
                .parentId(entity.getParentId())
                .nameEn(entity.getNameEn())
                .nameBn(entity.getNameBn())
                .slug(entity.getSlug())
                .icon(entity.getIcon())
                .description(entity.getDescription())
                .sortOrder(entity.getSortOrder())
                .depth(entity.getDepth())
                .path(entity.getPath())
                .isLeaf(entity.getIsLeaf())
                .productCount(prodCount)
                .childCount(kids.size())
                .children(childNodes)
                .build();
    }

    /** Get a single node + its direct children */
    public CategoryTreeNode getNode(String id) {
        CategoryEntity entity = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
        List<CategoryEntity> kids = categoryRepository.findByParentIdOrderBySortOrderAscNameEnAsc(id);
        Map<String, List<CategoryEntity>> childrenMap = new HashMap<>();
        // Only one level deep for single node
        return buildNode(entity, Map.of(id, kids));
    }

    /** Build breadcrumb trail for a category */
    public List<BreadcrumbItem> getBreadcrumb(String categoryId) {
        List<BreadcrumbItem> crumbs = new ArrayList<>();
        String currentId = categoryId;
        Set<String> visited = new HashSet<>();
        while (currentId != null && !visited.contains(currentId)) {
            visited.add(currentId);
            CategoryEntity cat = categoryRepository.findById(currentId).orElse(null);
            if (cat == null) break;
            crumbs.add(0, BreadcrumbItem.builder()
                    .id(cat.getId())
                    .nameEn(cat.getNameEn())
                    .nameBn(cat.getNameBn())
                    .slug(cat.getSlug())
                    .build());
            currentId = cat.getParentId();
        }
        return crumbs;
    }

    /** Create a new category */
    @Transactional
    public CategoryEntity create(CategoryRequest req) {
        String name = req.getName() != null ? req.getName().trim() : "";
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category name is required");
        }

        CategoryEntity parent = null;
        if (req.getParentId() != null && !req.getParentId().isBlank()) {
            parent = categoryRepository.findById(req.getParentId().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent category not found"));
        }

        String slug = generateUniqueSlug(name);
        int depth = parent != null ? parent.getDepth() + 1 : 0;
        String path = parent != null ? parent.getPath() + "/" + slug : slug;

        CategoryEntity cat = new CategoryEntity();
        cat.setId(ShortId.newId8());
        cat.setParentId(parent != null ? parent.getId() : null);
        cat.setNameEn(name);
        cat.setNameBn(req.getNameBn() != null && !req.getNameBn().isBlank() ? req.getNameBn().trim() : name);
        cat.setSlug(slug);
        cat.setIcon(req.getIcon() != null ? req.getIcon().trim() : "");
        cat.setDescription(req.getDescription());
        cat.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        cat.setDepth(depth);
        cat.setPath(path);
        cat.setIsLeaf(true);

        CategoryEntity saved = categoryRepository.save(cat);

        // Mark parent as non-leaf
        if (parent != null && parent.getIsLeaf()) {
            parent.setIsLeaf(false);
            categoryRepository.save(parent);
        }

        return saved;
    }

    /** Rename / update a category */
    @Transactional
    public CategoryEntity update(String id, CategoryRequest req) {
        CategoryEntity existing = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        if (req.getName() != null && !req.getName().isBlank()) {
            String newName = req.getName().trim();
            existing.setNameEn(newName);
            // Re-slug
            String newSlug = generateUniqueSlug(newName, id);
            String oldSlug = existing.getSlug();
            existing.setSlug(newSlug);
            // Update path for self and descendants
            if (!oldSlug.equals(newSlug)) {
                recomputeSubtreePaths(existing);
            }
        }
        if (req.getNameBn() != null && !req.getNameBn().isBlank()) {
            existing.setNameBn(req.getNameBn().trim());
        }
        if (req.getIcon() != null) {
            existing.setIcon(req.getIcon().trim());
        }
        if (req.getDescription() != null) {
            existing.setDescription(req.getDescription());
        }
        if (req.getSortOrder() != null) {
            existing.setSortOrder(req.getSortOrder());
        }

        return categoryRepository.save(existing);
    }

    /** Move a category to a new parent */
    @Transactional
    public CategoryEntity move(String id, MoveRequest req) {
        CategoryEntity cat = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        String newParentId = req.getNewParentId();
        // Prevent moving to self or descendant
        if (id.equals(newParentId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot move category into itself");
        }

        CategoryEntity oldParent = cat.getParentId() != null ? categoryRepository.findById(cat.getParentId()).orElse(null) : null;
        CategoryEntity newParent = null;
        if (newParentId != null && !newParentId.isBlank()) {
            newParent = categoryRepository.findById(newParentId.trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "New parent category not found"));
            // Check not descendant
            if (isDescendant(newParentId, id)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot move category into its own descendant");
            }
        }

        cat.setParentId(newParent != null ? newParent.getId() : null);
        cat.setDepth(newParent != null ? newParent.getDepth() + 1 : 0);
        cat.setPath(newParent != null ? newParent.getPath() + "/" + cat.getSlug() : cat.getSlug());
        if (req.getSortOrder() != null) {
            cat.setSortOrder(req.getSortOrder());
        }
        categoryRepository.save(cat);
        recomputeSubtreePaths(cat);

        // Update new parent leaf status
        if (newParent != null && newParent.getIsLeaf()) {
            newParent.setIsLeaf(false);
            categoryRepository.save(newParent);
        }

        // Check if old parent is now leaf
        if (oldParent != null) {
            long remaining = categoryRepository.countByParentId(oldParent.getId());
            if (remaining == 0) {
                oldParent.setIsLeaf(true);
                categoryRepository.save(oldParent);
            }
        }

        return cat;
    }

    /** Delete a category */
    @Transactional
    public void delete(String id, boolean force) {
        CategoryEntity cat = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        long childCount = categoryRepository.countByParentId(id);
        long productCount = productRepository.countByCategoryId(id);

        if (!force && (childCount > 0 || productCount > 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Category has " + childCount + " subcategories and " + productCount + " products. Use ?force=true to cascade delete.");
        }

        String parentId = cat.getParentId();
        categoryRepository.deleteById(id);

        // Update parent leaf status
        if (parentId != null) {
            long remaining = categoryRepository.countByParentId(parentId);
            if (remaining == 0) {
                categoryRepository.findById(parentId).ifPresent(p -> {
                    p.setIsLeaf(true);
                    categoryRepository.save(p);
                });
            }
        }
    }

    private boolean isDescendant(String potentialDescendantId, String ancestorId) {
        Set<String> visited = new HashSet<>();
        String currentId = potentialDescendantId;
        while (currentId != null && !visited.contains(currentId)) {
            visited.add(currentId);
            if (currentId.equals(ancestorId)) return true;
            CategoryEntity c = categoryRepository.findById(currentId).orElse(null);
            currentId = c != null ? c.getParentId() : null;
        }
        return false;
    }

    private void recomputeSubtreePaths(CategoryEntity parent) {
        List<CategoryEntity> children = categoryRepository.findByParentId(parent.getId());
        for (CategoryEntity child : children) {
            child.setDepth(parent.getDepth() + 1);
            child.setPath(parent.getPath() + "/" + child.getSlug());
            categoryRepository.save(child);
            recomputeSubtreePaths(child);
        }
    }

    private String generateUniqueSlug(String name) {
        return generateUniqueSlug(name, null);
    }

    private String generateUniqueSlug(String name, String excludeId) {
        String base = name.toLowerCase()
                .replaceAll("[^a-z0-9\\s]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
        if (base.isEmpty()) base = "category";
        String candidate = base;
        int counter = 0;
        while (true) {
            Optional<CategoryEntity> existing = categoryRepository.findBySlug(candidate);
            if (existing.isEmpty() || (excludeId != null && existing.get().getId().equals(excludeId))) {
                return candidate;
            }
            counter++;
            candidate = base + "-" + counter;
        }
    }
}
