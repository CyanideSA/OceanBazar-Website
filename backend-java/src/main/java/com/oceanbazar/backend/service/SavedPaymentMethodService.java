package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.PaymentMethodDtos;
import com.oceanbazar.backend.entity.SavedPaymentMethodEntity;
import com.oceanbazar.backend.repository.SavedPaymentMethodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SavedPaymentMethodService {

    private static final int MAX_METHODS_PER_USER = 12;

    private final SavedPaymentMethodRepository repository;

    @Transactional(readOnly = true)
    public PaymentMethodDtos.ListResponse list(String userId) {
        requireUser(userId);
        List<SavedPaymentMethodEntity> entities = repository.findByUserIdOrderByCreatedAtDesc(userId.trim());
        List<PaymentMethodDtos.PaymentMethodResponse> items = entities.stream()
                .map(this::toResponse)
                .filter(r -> r.getId() != null && !r.getId().isBlank())
                .sorted(Comparator.comparing(PaymentMethodDtos.PaymentMethodResponse::isDefaultMethod).reversed()
                        .thenComparing((a, b) -> {
                            Date da = a.getCreatedAt() != null ? a.getCreatedAt() : new Date(0);
                            Date db = b.getCreatedAt() != null ? b.getCreatedAt() : new Date(0);
                            return db.compareTo(da);
                        }))
                .toList();
        PaymentMethodDtos.ListResponse out = new PaymentMethodDtos.ListResponse();
        out.setPaymentMethods(items);
        return out;
    }

    @Transactional
    public PaymentMethodDtos.PaymentMethodResponse add(String userId, PaymentMethodDtos.CreateRequest req) {
        requireUser(userId);
        String uid = userId.trim();
        long count = repository.countByUserId(uid);
        if (count >= MAX_METHODS_PER_USER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maximum saved payment methods reached");
        }

        String type = req.getType() == null ? "" : req.getType().trim().toUpperCase(Locale.ROOT);
        SavedPaymentMethodEntity m = new SavedPaymentMethodEntity();
        m.setUserId(uid);
        m.setType(type);
        m.setNickname(trimOrNull(req.getNickname()));

        switch (type) {
            case "CARD" -> fillCard(m, req);
            case "BKASH", "NAGAD" -> fillWallet(m, req, type);
            case "BANK" -> fillBank(m, req);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment type");
        }

        if (isDuplicate(uid, m)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This payment method is already saved");
        }

        boolean asDefault = Boolean.TRUE.equals(req.getSetAsDefault());
        if (asDefault || count == 0) {
            clearDefaultForUser(uid);
            m.setDefaultMethod(true);
        } else {
            m.setDefaultMethod(false);
        }

        Instant now = Instant.now();
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        SavedPaymentMethodEntity saved = repository.save(m);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String userId, String id) {
        requireUser(userId);
        String uid = userId.trim();
        SavedPaymentMethodEntity existing = findOwned(uid, id.trim());
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment method not found");
        }
        boolean wasDefault = existing.isDefaultMethod();
        repository.delete(existing);
        if (wasDefault) {
            promoteFirstAsDefault(uid);
        }
    }

    @Transactional
    public PaymentMethodDtos.PaymentMethodResponse setDefault(String userId, String id) {
        requireUser(userId);
        String uid = userId.trim();
        SavedPaymentMethodEntity existing = findOwned(uid, id.trim());
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment method not found");
        }
        clearDefaultForUser(uid);
        existing.setDefaultMethod(true);
        existing.setUpdatedAt(Instant.now());
        repository.save(existing);
        return toResponse(existing);
    }

    private void requireUser(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
    }

    private void clearDefaultForUser(String uid) {
        List<SavedPaymentMethodEntity> all = repository.findByUserIdOrderByCreatedAtDesc(uid);
        Instant now = Instant.now();
        for (SavedPaymentMethodEntity e : all) {
            if (e.isDefaultMethod()) {
                e.setDefaultMethod(false);
                e.setUpdatedAt(now);
                repository.save(e);
            }
        }
    }

    private SavedPaymentMethodEntity findOwned(String uid, String id) {
        return repository.findById(id)
                .filter(e -> uid.equals(e.getUserId()))
                .orElse(null);
    }

    private void promoteFirstAsDefault(String uid) {
        List<SavedPaymentMethodEntity> all = repository.findByUserIdOrderByCreatedAtDesc(uid);
        if (all.isEmpty()) return;
        SavedPaymentMethodEntity first = all.get(0);
        first.setDefaultMethod(true);
        first.setUpdatedAt(Instant.now());
        repository.save(first);
    }

    private boolean isDuplicate(String uid, SavedPaymentMethodEntity m) {
        List<SavedPaymentMethodEntity> existing = repository.findByUserIdOrderByCreatedAtDesc(uid);
        for (SavedPaymentMethodEntity e : existing) {
            String t = e.getType() == null ? "" : e.getType().trim().toUpperCase(Locale.ROOT);
            if (!Objects.equals(t, m.getType())) continue;
            if ("CARD".equals(m.getType())) {
                if (Objects.equals(e.getLast4(), m.getLast4())
                        && Objects.equals(e.getExpiryMonth(), m.getExpiryMonth())
                        && Objects.equals(e.getExpiryYear(), m.getExpiryYear())) {
                    return true;
                }
            } else if ("BKASH".equals(m.getType()) || "NAGAD".equals(m.getType())) {
                if (Objects.equals(e.getWalletLast4(), m.getWalletLast4())
                        && Objects.equals(e.getWalletProvider(), m.getWalletProvider())) {
                    return true;
                }
            } else if ("BANK".equals(m.getType())) {
                if (Objects.equals(e.getBankAccountLast4(), m.getBankAccountLast4())
                        && Objects.equals(normalizeBank(e.getBankName()), normalizeBank(m.getBankName()))) {
                    return true;
                }
            }
        }
        return false;
    }

    private static String normalizeBank(String b) {
        return b == null ? "" : b.trim().toLowerCase(Locale.ROOT);
    }

    private void fillCard(SavedPaymentMethodEntity m, PaymentMethodDtos.CreateRequest req) {
        String last4 = digitsOnly(req.getLast4());
        if (last4.length() != 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Card last4 must be exactly 4 digits");
        }
        Integer month = req.getExpiryMonth();
        Integer year = req.getExpiryYear();
        if (month == null || year == null || month < 1 || month > 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid expiry month and year required");
        }
        YearMonth exp = YearMonth.of(year, month);
        if (exp.isBefore(YearMonth.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Card appears expired");
        }
        String brand = trimOrNull(req.getCardBrand());
        if (brand == null || brand.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Card brand is required");
        }
        m.setCardBrand(brand);
        m.setLast4(last4);
        m.setExpiryMonth(month);
        m.setExpiryYear(year);
        m.setWalletProvider(null);
        m.setWalletLast4(null);
        m.setBankName(null);
        m.setBankAccountLast4(null);
    }

    private void fillWallet(SavedPaymentMethodEntity m, PaymentMethodDtos.CreateRequest req, String type) {
        String hint = digitsOnly(req.getWalletLast4());
        if (hint.length() != 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Last 4 digits of wallet number required");
        }
        m.setWalletProvider(type.equals("BKASH") ? "bKash" : "Nagad");
        m.setWalletLast4(hint);
        m.setCardBrand(null);
        m.setLast4(null);
        m.setExpiryMonth(null);
        m.setExpiryYear(null);
        m.setBankName(null);
        m.setBankAccountLast4(null);
    }

    private void fillBank(SavedPaymentMethodEntity m, PaymentMethodDtos.CreateRequest req) {
        String bank = trimOrNull(req.getBankName());
        if (bank == null || bank.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bank name is required");
        }
        String last4 = digitsOnly(req.getBankAccountLast4());
        if (last4.length() != 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Last 4 digits of account number required");
        }
        m.setBankName(bank);
        m.setBankAccountLast4(last4);
        m.setCardBrand(null);
        m.setLast4(null);
        m.setExpiryMonth(null);
        m.setExpiryYear(null);
        m.setWalletProvider(null);
        m.setWalletLast4(null);
    }

    private static String digitsOnly(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("\\D", "");
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private PaymentMethodDtos.PaymentMethodResponse toResponse(SavedPaymentMethodEntity m) {
        PaymentMethodDtos.PaymentMethodResponse o = new PaymentMethodDtos.PaymentMethodResponse();
        o.setId(m.getId());
        o.setType(m.getType());
        o.setNickname(m.getNickname());
        o.setCardBrand(m.getCardBrand());
        o.setLast4(m.getLast4());
        o.setExpiryMonth(m.getExpiryMonth());
        o.setExpiryYear(m.getExpiryYear());
        o.setWalletProvider(m.getWalletProvider());
        o.setWalletLast4(m.getWalletLast4());
        o.setBankName(m.getBankName());
        o.setBankAccountLast4(m.getBankAccountLast4());
        o.setDefaultMethod(m.isDefaultMethod());
        o.setCreatedAt(m.getCreatedAt() != null ? Date.from(m.getCreatedAt()) : new Date(0));
        o.setDisplaySummary(buildSummary(m));
        return o;
    }

    private static String buildSummary(SavedPaymentMethodEntity m) {
        if (m == null) return "";
        return switch (m.getType() == null ? "" : m.getType()) {
            case "CARD" -> (m.getCardBrand() != null ? m.getCardBrand() : "Card") + " •••• " + (m.getLast4() != null ? m.getLast4() : "****")
                    + (m.getExpiryMonth() != null && m.getExpiryYear() != null
                    ? " · exp " + m.getExpiryMonth() + "/" + (m.getExpiryYear() % 100) : "");
            case "BKASH", "NAGAD" -> (m.getWalletProvider() != null ? m.getWalletProvider() : m.getType()) + " •••• " + safe4(m.getWalletLast4());
            case "BANK" -> (m.getBankName() != null ? m.getBankName() : "Bank") + " ·••• " + safe4(m.getBankAccountLast4());
            default -> "Saved method";
        };
    }

    private static String safe4(String v) {
        return v != null && v.length() == 4 ? v : "****";
    }
}
