package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.AdminOrderDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.AuditLogRepository;
import com.oceanbazar.backend.repository.NotificationRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.PaymentTransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminOrderCommandServiceTest {
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private PaymentTransactionRepository paymentTransactionRepository;
    @Mock
    private AdminAlertService adminAlertService;
    @Mock
    private AdminUserRepository adminUserRepository;
    @Mock
    private AuditLogRepository auditLogRepository;

    @InjectMocks
    private AdminOrderCommandService service;

    @Test
    void rejectsInvalidOrderStatusTransition() {
        OrderEntity order = new OrderEntity();
        order.setId("ord-1");
        order.setUserId("u-1");
        order.setStatus(OrderStatus.pending);
        when(orderRepository.findById("ord-1")).thenReturn(Optional.of(order));

        AdminOrderDtos.AdminOrderStatusUpdateRequest req = new AdminOrderDtos.AdminOrderStatusUpdateRequest();
        req.setStatus("delivered");

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> service.updateOrderStatus("admin-1", "ord-1", req)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertEquals("Invalid order status transition: pending -> delivered", ex.getReason());
    }
}

