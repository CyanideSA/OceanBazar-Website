package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.PaymentDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.PaymentTransactionEntity;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.entity.enums.PaymentMethod;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import com.oceanbazar.backend.payments.PaymentGateway;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private PaymentTransactionRepository paymentTransactionRepository;
    @Mock
    private AdminAlertService adminAlertService;
    @Mock
    private CustomerNotificationService customerNotificationService;

    @Test
    void marksPaymentFailedWhenGatewayThrows() {
        PaymentGateway failingGateway = new PaymentGateway() {
            @Override
            public String providerKey() {
                return "placeholder";
            }

            @Override
            public void applySuccessfulPlaceholderPayment(OrderEntity order) {
                throw new RuntimeException("gateway down");
            }
        };
        PaymentService service = new PaymentService(
                orderRepository,
                paymentTransactionRepository,
                adminAlertService,
                customerNotificationService,
                List.of(failingGateway)
        );

        OrderEntity order = new OrderEntity();
        order.setId("ord-1");
        order.setUserId("u-1");
        order.setStatus(OrderStatus.pending);
        order.setPaymentStatus(PaymentStatus.unpaid);
        order.setTotal(BigDecimal.valueOf(120));
        when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));
        when(paymentTransactionRepository.findTopByOrderIdAndMethodOrderByCreatedAtDesc(eq("ord-1"), eq(PaymentMethod.sslcommerz)))
                .thenReturn(Optional.empty());
        when(paymentTransactionRepository.save(any(PaymentTransactionEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.save(any(OrderEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PaymentDtos.PaymentPlaceholderRequest req = new PaymentDtos.PaymentPlaceholderRequest();
        req.setOrderId("ord-1");
        req.setPaymentMethod("placeholder");

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> service.authorizePlaceholder("u-1", req)
        );

        assertEquals(502, ex.getStatusCode().value());
        assertEquals("Payment authorization failed", ex.getReason());

        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
        OrderEntity lastSavedOrder = orderCaptor.getValue();
        assertEquals(PaymentStatus.unpaid, lastSavedOrder.getPaymentStatus());
    }
}
