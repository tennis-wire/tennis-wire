package com.tenniswire.content_service.entity.converter;

import com.tenniswire.content_service.entity.MediaType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class MediaTypeConverter implements AttributeConverter<MediaType, String> {

    @Override
    public String convertToDatabaseColumn(MediaType attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public MediaType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : MediaType.fromValue(dbData);
    }
}
