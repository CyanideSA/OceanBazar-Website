package com.oceanbazar.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class LocalFileStorageService {
    @Value("${app.public-base-url:https://localhost:8000}")
    private String publicBaseUrl;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    public String store(MultipartFile file) throws IOException {
        return storeInSubfolder(file, "");
    }

    public String storeProductMedia(MultipartFile file) throws IOException {
        return storeInSubfolder(file, "products");
    }

    private String storeInSubfolder(MultipartFile file, String subfolder) throws IOException {
        String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename());
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) {
            ext = original.substring(dot).toLowerCase();
            if (ext.length() > 10) ext = "";
        }
        String safeName = UUID.randomUUID().toString() + ext;
        Path dir = StringUtils.hasText(subfolder)
                ? Paths.get(uploadDir, subfolder)
                : Paths.get(uploadDir);
        Files.createDirectories(dir);
        Path dest = dir.resolve(safeName);
        file.transferTo(dest.toFile());
        String base = publicBaseUrl.replaceAll("/$", "");
        if (StringUtils.hasText(subfolder)) {
            return base + "/uploads/" + subfolder + "/" + safeName;
        }
        return base + "/uploads/" + safeName;
    }
}
