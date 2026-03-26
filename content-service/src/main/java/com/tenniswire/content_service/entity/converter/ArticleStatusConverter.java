package com.tenniswire.content_service.entity.converter;

import com.tenniswire.content_service.entity.ArticleStatus;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ArticleStatusConverter implements AttributeConverter<ArticleStatus, String> {

    @Override
    public String convertToDatabaseColumn(ArticleStatus attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public ArticleStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ArticleStatus.fromValue(dbData);
    }
}
