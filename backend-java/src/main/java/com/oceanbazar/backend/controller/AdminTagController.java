package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.CatalogDtos.*;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.security.AdminTokenService;
import com.oceanbazar.backend.service.TagService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminTagController {
    private final TagService tagService;
    private final AdminTokenService adminTokenService;
    private final AdminUserRepository adminUserRepository;

    private static final Set<String> R_ALL    = Set.of("SUPER_ADMIN", "ADMIN", "STAFF");
    private static final Set<String> R_ADMIN  = Set.of("SUPER_ADMIN", "ADMIN");

    // ─── Tag Groups ──────────────────────────────────────────────────────────
    @GetMapping("/tag-groups")
    public List<TagGroupDto> listGroups(@RequestHeader("Authorization") String auth) {
        requireAnyRole(auth, R_ALL);
        return tagService.listGroups();
    }

    @PostMapping("/tag-groups")
    public TagGroupDto createGroup(@RequestHeader("Authorization") String auth,
                                    @RequestBody TagGroupRequest req) {
        requireAnyRole(auth, R_ADMIN);
        return tagService.createGroup(req);
    }

    @PutMapping("/tag-groups/{id}")
    public TagGroupDto updateGroup(@RequestHeader("Authorization") String auth,
                                    @PathVariable Integer id,
                                    @RequestBody TagGroupRequest req) {
        requireAnyRole(auth, R_ADMIN);
        return tagService.updateGroup(id, req);
    }

    @DeleteMapping("/tag-groups/{id}")
    public Map<String, Object> deleteGroup(@RequestHeader("Authorization") String auth,
                                            @PathVariable Integer id) {
        requireAnyRole(auth, R_ADMIN);
        tagService.deleteGroup(id);
        return Map.of("success", true);
    }

    // ─── Tags ────────────────────────────────────────────────────────────────
    @PostMapping("/tags")
    public TagDto createTag(@RequestHeader("Authorization") String auth,
                             @RequestBody TagRequest req) {
        requireAnyRole(auth, R_ADMIN);
        return tagService.createTag(req);
    }

    @PutMapping("/tags/{id}")
    public TagDto updateTag(@RequestHeader("Authorization") String auth,
                             @PathVariable Integer id,
                             @RequestBody TagRequest req) {
        requireAnyRole(auth, R_ADMIN);
        return tagService.updateTag(id, req);
    }

    @DeleteMapping("/tags/{id}")
    public Map<String, Object> deleteTag(@RequestHeader("Authorization") String auth,
                                          @PathVariable Integer id) {
        requireAnyRole(auth, R_ADMIN);
        tagService.deleteTag(id);
        return Map.of("success", true);
    }

    // ─── Product Tag Links ────────────────────────────────────────────────────
    @GetMapping("/products/{productId}/tags")
    public List<TagDto> productTags(@RequestHeader("Authorization") String auth,
                                     @PathVariable String productId) {
        requireAnyRole(auth, R_ALL);
        return tagService.getProductTags(productId);
    }

    @PutMapping("/products/{productId}/tags")
    public Map<String, Object> setProductTags(@RequestHeader("Authorization") String auth,
                                               @PathVariable String productId,
                                               @RequestBody Map<String, List<Integer>> body) {
        requireAnyRole(auth, R_ADMIN);
        tagService.setProductTags(productId, body.get("tagIds"));
        return Map.of("success", true);
    }

    private Claims requireAnyRole(String authorization, Set<String> allowedRoles) {
        return AdminControllerSupport.requireAnyRole(adminTokenService, adminUserRepository, authorization, allowedRoles);
    }
}
