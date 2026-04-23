package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.PaymentTransactionEntity;
import com.oceanbazar.backend.entity.enums.PaymentTxStatus;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.PaymentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminPaymentQueryService {
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OrderRepository orderRepository;

    public List<Map<String, Object>> listPayments(String status) {
        List<PaymentTransactionEntity> txs;
        if (status != null && !status.isBlank()) {
            PaymentTxStatus normalized = mapToPaymentTxStatus(status.trim());
            txs = paymentTransactionRepository.findByStatusOrderByCreatedAtDesc(normalized);
        } else {
            txs = paymentTransactionRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        Map<String, OrderEntity> ordersById = loadOrdersForTransactions(txs);

        List<Map<String, Object>> out = new ArrayList<>();
        for (PaymentTransactionEntity t : txs) {
            OrderEntity order = t.getOrderId() != null ? ordersById.get(t.getOrderId()) : null;
            out.add(toAdminPaymentListRow(t, order));
        }
        return out;
    }

    private Map<String, OrderEntity> loadOrdersForTransactions(List<PaymentTransactionEntity> txs) {
        Set<String> orderIds = txs.stream()
                .map(PaymentTransactionEntity::getOrderId)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .collect(Collectors.toSet());
        if (orderIds.isEmpty()) {
            return Map.of();
        }
        Map<String, OrderEntity> map = new HashMap<>();
        for (OrderEntity o : orderRepository.findAllById(orderIds)) {
            if (o.getId() != null) {
                map.put(o.getId(), o);
            }
        }
        return map;
    }

    private static Map<String, Object> toAdminPaymentListRow(PaymentTransactionEntity t, OrderEntity order) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("transactionId", t.getId());
        m.put("paymentMethod", t.getMethod() != null ? t.getMethod().name() : "unknown");
        m.put("paymentStatus", t.getStatus() != null ? t.getStatus().name() : null);
        m.put("amount", t.getAmount() == null ? 0.0 : t.getAmount());
        m.put("currency", t.getCurrency() == null ? "BDT" : t.getCurrency());
        m.put("createdAt", t.getCreatedAt());
        putOrderCustomerFields(m, t, order);
        return m;
    }

    private static void putOrderCustomerFields(Map<String, Object> m, PaymentTransactionEntity t, OrderEntity order) {
        String oid = t.getOrderId();
        String uid = t.getUserId();
        if (uid != null && !uid.isBlank()) {
            m.put("customerId", uid.trim());
        } else if (order != null && order.getUserId() != null && !order.getUserId().isBlank()) {
            m.put("customerId", order.getUserId().trim());
        } else {
            m.put("customerId", null);
        }

        if (oid != null && !oid.isBlank()) {
            m.put("orderId", oid.trim());
        } else {
            m.put("orderId", null);
        }

        if (order != null) {
            m.put("orderNumber", order.getOrderNumber());
            m.put("orderStatus", order.getStatus() != null ? order.getStatus().name() : null);
        } else {
            m.put("orderNumber", null);
            m.put("orderStatus", null);
        }
    }

    public Map<String, Object> paymentDetail(String id) {
        PaymentTransactionEntity tx = paymentTransactionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment transaction not found"));

        OrderEntity order = null;
        if (tx.getOrderId() != null && !tx.getOrderId().isBlank()) {
            order = orderRepository.findById(tx.getOrderId()).orElse(null);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("transaction", toAdminPaymentTransactionView(tx, order));
        return out;
    }

    private static Map<String, Object> toAdminPaymentTransactionView(PaymentTransactionEntity tx, OrderEntity order) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", tx.getId());
        m.put("paymentMethod", tx.getMethod() != null ? tx.getMethod().name() : "unknown");
        m.put("paymentStatus", tx.getStatus() != null ? tx.getStatus().name() : null);
        m.put("amount", tx.getAmount() == null ? 0.0 : tx.getAmount());
        m.put("currency", tx.getCurrency() == null ? "BDT" : tx.getCurrency());
        m.put("createdAt", tx.getCreatedAt());
        m.put("updatedAt", null);
        m.put("providerTransactionId", tx.getProviderTxId());
        m.put("trackingNumber", null);
        m.put("statusHistory", List.of());
        m.put("metadata", safeMetadataForAdmin(tx.getMetadata()));
        putOrderCustomerFields(m, tx, order);
        return m;
    }

    private static Map<String, Object> safeMetadataForAdmin(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return Map.of();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("raw", metadataJson);
        return out;
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
}
