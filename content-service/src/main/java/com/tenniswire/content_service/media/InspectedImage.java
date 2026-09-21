package com.tenniswire.content_service.media;

// bytes are what gets stored: the upload with its metadata removed
public record InspectedImage(String mimeType, String extension, int width, int height, byte[] bytes) {}
