package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.NotificationEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AdminAlertService {
    private final NotificationRepository notificationRepository;

    @Value("${oceanbazar.admin.low-stock-threshold:10}")
    private int lowStockThreshold;

    public int getLowStockThreshold() {
        return lowStockThreshold;
    }

    public void notifyNewOrder(OrderEntity order) {
        if (order == null || order.getId() == null) return;
        NotificationEntity n = baseAdminAlert("new_order");
        n.setEntityId(order.getId());
        n.setTitle("New order");
        n.setMessage("Order " + order.getId() + " placed - total "
                + (order.getTotal() == null ? "0" : order.getTotal().toPlainString())
                + " BDT (customer " + (order.getUserId() == null ? "unknown" : order.getUserId()) + ").");
        notificationRepository.save(n);
    }

    public void notifyPaymentChanged(OrderEntity order, String previousPaymentStatus, String newPaymentStatus, String transactionId) {
        if (order == null || order.getId() == null) return;
        if (Objects.equals(previousPaymentStatus, newPaymentStatus)) return;
        NotificationEntity n = baseAdminAlert("payment_update");
        n.setEntityId(order.getId());
        n.setTitle("Payment update");
        String from = previousPaymentStatus == null || previousPaymentStatus.isBlank() ? "none" : previousPaymentStatus;
        String to = newPaymentStatus == null || newPaymentStatus.isBlank() ? "none" : newPaymentStatus;
        String tx = transactionId == null ? "" : " Transaction " + transactionId + ".";
        n.setMessage("Order " + order.getId() + ": payment " + from + " -> " + to + "." + tx);
        notificationRepository.save(n);
    }

    /**
     * Alert when stock crosses from strictly above threshold down to at or below threshold.
     */
    public void notifyLowStockIfNeeded(ProductEntity product, Integer stockBefore) {
        if (product == null || product.getId() == null) return;
        int threshold = lowStockThreshold;
        int now = product.getStock() == null ? 0 : product.getStock();
        int before = stockBefore == null ? Integer.MAX_VALUE : stockBefore;
        if (!(before > threshold && now <= threshold)) {
            return;
        }
        NotificationEntity n = baseAdminAlert("low_stock");
        n.setEntityId(product.getId());
        n.setTitle("Low stock");
        n.setMessage("Product \"" + (product.getTitleEn() == null ? product.getId() : product.getTitleEn())
                + "\" is at " + now + " units (threshold " + threshold + ").");
        notificationRepository.save(n);
    }

    private static NotificationEntity baseAdminAlert(String kind) {
        NotificationEntity n = new NotificationEntity();
        n.setAudience("admins");
        n.setKind(kind);
        n.setReadStatus(false);
        n.setCreatedAt(Instant.now());
        return n;
    }
}
