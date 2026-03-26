package com.tenniswire.content_service.entity.converter;

import com.tenniswire.content_service.entity.ArticleType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ArticleTypeConverter implements AttributeConverter<ArticleType, String> {

    @Override
    public String convertToDatabaseColumn(ArticleType attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public ArticleType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ArticleType.fromValue(dbData);
    }
}
