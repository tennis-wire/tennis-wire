package com.tenniswire.content_service.entity.converter;

import com.tenniswire.content_service.entity.TagType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class TagTypeConverter implements AttributeConverter<TagType, String> {

    @Override
    public String convertToDatabaseColumn(TagType attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public TagType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : TagType.fromValue(dbData);
    }
}
