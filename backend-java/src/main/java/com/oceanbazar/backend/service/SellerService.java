package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.SellerEntity;
import com.oceanbazar.backend.repository.SellerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class SellerService {
    private final SellerRepository sellerRepository;

    public SellerEntity getById(String id) {
        return sellerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Seller not found"));
    }

    public SellerEntity register(SellerEntity seller) {
        if (sellerRepository.existsByUserId(seller.getUserId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seller profile already exists");
        }
        seller.setStatus("pending");
        seller.setCreatedAt(Instant.now());
        seller.setUpdatedAt(Instant.now());
        return sellerRepository.save(seller);
    }

    public SellerEntity updateProfile(String sellerId, SellerEntity updates, String authenticatedUserId) {
        SellerEntity seller = getById(sellerId);
        if (seller.getUserId() == null || !seller.getUserId().equals(authenticatedUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your seller profile");
        }
        if (updates.getBusinessName() != null) seller.setBusinessName(updates.getBusinessName());
        if (updates.getDescription() != null) seller.setDescription(updates.getDescription());
        if (updates.getLogo() != null) seller.setLogo(updates.getLogo());
        if (updates.getBanner() != null) seller.setBanner(updates.getBanner());
        if (updates.getContactEmail() != null) seller.setContactEmail(updates.getContactEmail());
        if (updates.getContactPhone() != null) seller.setContactPhone(updates.getContactPhone());
        if (updates.getCategories() != null) seller.setCategories(updates.getCategories());
        seller.setUpdatedAt(Instant.now());
        return sellerRepository.save(seller);
    }
}
