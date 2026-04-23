package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.CatalogDtos;
import com.oceanbazar.backend.dto.CatalogDtos.*;
import com.oceanbazar.backend.entity.CategoryEntity;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.CategoryRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.CategoryTreeService;
import com.oceanbazar.backend.service.ProductExplorerService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
public class AdminCategoryController {
    private final CategoryRepository categoryRepository;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;
    private final CategoryTreeService categoryTreeService;
    private final ProductExplorerService productExplorerService;

    private static final Set<String> R_ALL = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN_UP = Set.of("SUPER_ADMIN", "ADMIN");

    /** Flat list (backward compatible) */
    @GetMapping
    public List<CategoryEntity> list(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        return categoryRepository.findAll(Sort.by(Sort.Direction.ASC, "sortOrder", "nameEn"));
    }

    /** Full recursive tree */
    @GetMapping("/tree")
    public List<CategoryTreeNode> tree(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        return categoryTreeService.buildTree();
    }

    /** Single node + direct children */
    @GetMapping("/{id}")
    public CategoryTreeNode getNode(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        return categoryTreeService.getNode(id);
    }

    /** Breadcrumb trail */
    @GetMapping("/{id}/breadcrumb")
    public List<BreadcrumbItem> breadcrumb(@RequestHeader("Authorization") String authorization, @PathVariable String id) {
        requireAnyRole(authorization, R_ALL);
        return categoryTreeService.getBreadcrumb(id);
    }

    /** Folder contents (subfolders + products) */
    @GetMapping("/{id}/contents")
    public FolderContents contents(@RequestHeader("Authorization") String authorization,
                                   @PathVariable String id,
                                   @RequestParam(defaultValue = "1") int page,
                                   @RequestParam(defaultValue = "50") int size) {
        requireAnyRole(authorization, R_ALL);
        return productExplorerService.getFolderContents(id, page, size);
    }

    /** Root folder contents */
    @GetMapping("/root/contents")
    public FolderContents rootContents(@RequestHeader("Authorization") String authorization) {
        requireAnyRole(authorization, R_ALL);
        return productExplorerService.getRootContents();
    }

    /** Create category */
    @PostMapping
    public CategoryEntity create(@RequestHeader("Authorization") String authorization,
                                  @RequestBody CatalogDtos.CategoryRequest request) {
        requireAnyRole(authorization, R_ADMIN_UP);
        return categoryTreeService.create(request);
    }

    /** Update (rename) category */
    @PutMapping("/{id}")
    public CategoryEntity update(@RequestHeader("Authorization") String authorization,
                                  @PathVariable String id,
                                  @RequestBody CatalogDtos.CategoryRequest request) {
        requireAnyRole(authorization, R_ADMIN_UP);
        return categoryTreeService.update(id, request);
    }

    /** Move category to new parent */
    @PatchMapping("/{id}/move")
    public CategoryEntity move(@RequestHeader("Authorization") String authorization,
                                @PathVariable String id,
                                @RequestBody MoveRequest request) {
        requireAnyRole(authorization, R_ADMIN_UP);
        return categoryTreeService.move(id, request);
    }

    /** Delete category */
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@RequestHeader("Authorization") String authorization,
                                       @PathVariable String id,
                                       @RequestParam(defaultValue = "false") boolean force) {
        requireAnyRole(authorization, R_ADMIN_UP);
        categoryTreeService.delete(id, force);
        return Map.of("success", true);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
