package com.oceanbazar.backend.mapper;

import com.oceanbazar.backend.dto.OrderDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderItemEntity;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public final class OrderMapper {
    private OrderMapper() {}

    public static OrderDtos.OrderResponseDto toOrderResponse(OrderEntity order) {
        if (order == null) {
            return null;
        }

        List<OrderDtos.OrderItemDto> items = new ArrayList<>();
        if (order.getItems() != null) {
            for (OrderItemEntity raw : order.getItems()) {
                if (raw == null) continue;
                items.add(toOrderItem(raw));
            }
        }

        OrderDtos.OrderResponseDto out = new OrderDtos.OrderResponseDto();
        out.setId(order.getId());
        out.setOrderNumber(order.getOrderNumber());
        out.setUserId(order.getUserId());
        out.setItems(items);
        out.setSubtotal(toDouble(order.getSubtotal()));
        out.setShipping(toDouble(order.getShippingFee()));
        out.setGst(toDouble(order.getGst()));
        out.setServiceFee(toDouble(order.getServiceFee()));
        out.setTotal(toDouble(order.getTotal()));
        out.setStatus(order.getStatus() != null ? order.getStatus().name() : null);
        out.setTrackingNumber(order.getTrackingNumber());
        out.setPaymentMethod(order.getPaymentMethod() != null ? order.getPaymentMethod().name() : null);
        out.setPaymentStatus(order.getPaymentStatus() != null ? order.getPaymentStatus().name() : null);
        out.setShippingAddress(null);
        out.setCreatedAt(order.getCreatedAt() == null ? null : Date.from(order.getCreatedAt()));
        out.setReturnStatus("none");
        out.setReturnReason(null);
        out.setBuyerRating(null);
        out.setBuyerFeedback(null);
        out.setBuyerFeedbackAt(null);
        return out;
    }

    private static OrderDtos.OrderItemDto toOrderItem(OrderItemEntity raw) {
        OrderDtos.OrderItemDto item = new OrderDtos.OrderItemDto();
        item.setProductId(raw.getProductId());
        item.setName(raw.getProductTitle());
        item.setCategory(null);
        item.setImageUrl(null);
        item.setUnitPrice(toDouble(raw.getUnitPrice()));
        item.setQuantity(raw.getQuantity());
        item.setLineTotal(toDouble(raw.getLineTotal()));
        return item;
    }

    private static Double toDouble(BigDecimal v) {
        if (v == null) return 0.0;
        return v.doubleValue();
    }
}
