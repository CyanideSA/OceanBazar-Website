package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.LocalFileStorageService;
import com.oceanbazar.backend.service.TicketService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Customer-facing ticket endpoints: /api/tickets/**
 * Admin ticket endpoints: /api/admin/tickets/**
 */
@RestController
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;
    private final AuthTokenService authTokenService;
    private final LocalFileStorageService fileStorageService;

    /* ─────────────────────────── CUSTOMER ─────────────────────────── */

    /** POST /api/tickets — create a new support ticket */
    @PostMapping("/api/tickets")
    public Map<String, Object> create(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody TicketService.CreateTicketRequest req
    ) {
        String userId = requireUser(auth);
        return ticketService.createTicket(userId, req);
    }

    /** GET /api/tickets — list my tickets */
    @GetMapping("/api/tickets")
    public List<Map<String, Object>> list(
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        String userId = requireUser(auth);
        return ticketService.listForUser(userId);
    }

    /** GET /api/tickets/{id} — get my ticket */
    @GetMapping("/api/tickets/{id}")
    public Map<String, Object> get(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String id
    ) {
        String userId = requireUser(auth);
        return ticketService.getForUser(id, userId);
    }

    /** POST /api/tickets/{id}/messages — reply to a ticket */
    @PostMapping("/api/tickets/{id}/messages")
    public Map<String, Object> reply(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String id,
            @RequestBody ReplyRequest req
    ) {
        String userId = requireUser(auth);
        return ticketService.replyAsCustomer(id, userId, req.getMessage(), req.getAttachments());
    }

    /** POST /api/tickets/{id}/seen — mark as seen (no-op, returns ok) */
    @PostMapping("/api/tickets/{id}/seen")
    public Map<String, Object> seen(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String id
    ) {
        requireUser(auth);
        return Map.of("ok", true);
    }

    /** POST /api/tickets/upload — upload attachment, returns URL */
    @PostMapping(value = "/api/tickets/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadAttachment(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam("file") MultipartFile file
    ) {
        requireUser(auth);
        try {
            String url = fileStorageService.store(file);
            return Map.of("url", url);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Upload failed: " + e.getMessage());
        }
    }

    /* ─────────────────────────── ADMIN ─────────────────────────── */

    /** GET /api/admin/tickets — list all tickets with optional filters */
    @GetMapping("/api/admin/tickets")
    public Map<String, Object> adminList(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        requireAdmin(auth);
        return ticketService.adminList(status, priority, category, userId, page, size);
    }

    /** GET /api/admin/tickets/stats — counts per status */
    @GetMapping("/api/admin/tickets/stats")
    public Map<String, Object> adminStats(
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        requireAdmin(auth);
        return ticketService.stats();
    }

    /** GET /api/admin/tickets/{id} — get full ticket detail */
    @GetMapping("/api/admin/tickets/{id}")
    public Map<String, Object> adminGet(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String id
    ) {
        requireAdmin(auth);
        return ticketService.adminGet(id);
    }

    /** PUT /api/admin/tickets/{id} — update status/priority/assignedTo */
    @PutMapping("/api/admin/tickets/{id}")
    public Map<String, Object> adminUpdate(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String id,
            @RequestBody TicketService.AdminUpdateRequest req
    ) {
        requireAdmin(auth);
        return ticketService.adminUpdate(id, req);
    }

    /** POST /api/admin/tickets/{id}/reply — admin reply */
    @PostMapping("/api/admin/tickets/{id}/reply")
    public Map<String, Object> adminReply(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable String id,
            @RequestBody ReplyRequest req
    ) {
        String adminId = requireAdmin(auth);
        return ticketService.adminReply(id, adminId, req.getMessage(), req.getAttachments());
    }

    /** POST /api/admin/tickets — admin creates ticket on behalf of customer */
    @PostMapping("/api/admin/tickets")
    public Map<String, Object> adminCreate(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody TicketService.CreateTicketRequest req
    ) {
        String adminId = requireAdmin(auth);
        return ticketService.adminCreate(adminId, req);
    }

    /** POST /api/admin/tickets/upload — admin attachment upload */
    @PostMapping(value = "/api/admin/tickets/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> adminUpload(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam("file") MultipartFile file
    ) {
        requireAdmin(auth);
        try {
            String url = fileStorageService.store(file);
            return Map.of("url", url);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Upload failed: " + e.getMessage());
        }
    }

    /* ─────────────────────────── Helpers ─────────────────────────── */

    private String requireUser(String auth) {
        String userId = authTokenService.getUserIdFromAuthorization(auth);
        if (userId == null || userId.isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        return userId;
    }

    private String requireAdmin(String auth) {
        /* Reuse the same AuthTokenService — adminId stored as subject for admin tokens too */
        String id = authTokenService.getUserIdFromAuthorization(auth);
        if (id == null || id.isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin authentication required");
        return id;
    }

    @Data
    public static class ReplyRequest {
        @NotBlank
        @Size(max = 4000)
        private String message;
        private String[] attachments;
    }
}
