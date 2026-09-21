package com.tenniswire.content_service.controller.editorial;

import com.tenniswire.content_service.dto.editorial.MediaResponse;
import com.tenniswire.content_service.service.MediaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/editorial/media")
public class EditorialMediaController {

    private final MediaService mediaService;

    public EditorialMediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    @PostMapping(path = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MediaResponse uploadImage(@RequestPart("file") MultipartFile file) {
        return mediaService.uploadImage(file);
    }
}
