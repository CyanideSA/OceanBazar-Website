package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.AdminOrderDtos;
import com.oceanbazar.backend.entity.AuditLogEntity;
import com.oceanbazar.backend.entity.PaymentTransactionEntity;
import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.entity.enums.PaymentTxStatus;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.AuditLogRepository;
import com.oceanbazar.backend.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminPaymentCommandService {
    private static final Set<String> ALLOWED_PAYMENT_STATUSES = Set.of(
            "none", "pending", "processing", "paid", "failed", "refunded");

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final AdminOrderCommandService adminOrderCommandService;
    private final AuditLogRepository auditLogRepository;
    private final AdminUserRepository adminUserRepository;

    /**
     * Updates a payment ledger row. When this transaction is the latest for its order, delegates to
     * {@link AdminOrderCommandService#updatePaymentStatus} so the order and ledger stay aligned.
     */
    public Map<String, Object> updatePaymentTransaction(String actorAdminId, String transactionId,
                                                         AdminOrderDtos.AdminPaymentStatusUpdateRequest req) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (req == null || req.getPaymentStatus() == null || req.getPaymentStatus().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "paymentStatus is required");
        }
        String normalized = req.getPaymentStatus().trim().toLowerCase();
        if (!ALLOWED_PAYMENT_STATUSES.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment status");
        }

        PaymentTransactionEntity tx = paymentTransactionRepository.findById(transactionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment transaction not found"));

        String orderId = tx.getOrderId() == null ? null : tx.getOrderId().trim();
        Optional<PaymentTransactionEntity> latestOpt = orderId == null || orderId.isEmpty()
                ? Optional.empty()
                : paymentTransactionRepository.findTopByOrderIdOrderByCreatedAtDesc(orderId);

        boolean isLatestForOrder = latestOpt.isPresent() && transactionId.equals(latestOpt.get().getId());

        if (isLatestForOrder) {
            Map<String, Object> inner = adminOrderCommandService.updatePaymentStatus(actorAdminId, orderId, req);
            Map<String, Object> out = new LinkedHashMap<>(inner);
            out.put("orderSynced", true);
            out.put("transactionId", transactionId);
            return out;
        }

        PaymentTxStatus target = mapToPaymentTxStatus(normalized);
        String wire = target.name();
        String note = req.getNote();
        if (note != null && note.isBlank()) {
            note = null;
        }
        if (!Objects.equals(tx.getStatus(), target)) {
            tx.setStatus(target);
        }
        paymentTransactionRepository.save(tx);

        logAction(actorAdminId, "UPDATE_PAYMENT_TRANSACTION", "payment_transaction", tx.getId(),
                "orderSynced=false status=" + wire + (note != null ? " note=" + truncateAudit(note, 120) : ""));

        return Map.of(
                "success", true,
                "transactionId", tx.getId(),
                "paymentStatus", wire,
                "orderSynced", false
        );
    }

    private static PaymentTxStatus mapToPaymentTxStatus(String raw) {
        if (raw == null || raw.isBlank()) return PaymentTxStatus.pending;
        return switch (raw.trim().toLowerCase()) {
            case "paid", "success" -> PaymentTxStatus.success;
            case "failed" -> PaymentTxStatus.failed;
            case "refunded" -> PaymentTxStatus.refunded;
            default -> PaymentTxStatus.pending;
        };
    }

    private static String truncateAudit(String s, int max) {
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max) + "…";
    }

    private void logAction(String adminId, String action, String targetType, String targetId, String details) {
        AuditLogEntity log = new AuditLogEntity();
        log.setAdminId(Integer.valueOf(adminId));
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetails(details);
        auditLogRepository.save(log);
    }
}
