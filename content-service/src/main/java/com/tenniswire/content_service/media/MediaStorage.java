package com.tenniswire.content_service.media;

public interface MediaStorage {

    void put(String key, byte[] bytes, String contentType);
}
