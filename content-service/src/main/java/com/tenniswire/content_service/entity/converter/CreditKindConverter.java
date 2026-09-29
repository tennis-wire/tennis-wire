package com.tenniswire.content_service.entity.converter;

import com.tenniswire.content_service.entity.CreditKind;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class CreditKindConverter implements AttributeConverter<CreditKind, String> {

    @Override
    public String convertToDatabaseColumn(CreditKind attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public CreditKind convertToEntityAttribute(String dbData) {
        return dbData == null ? null : CreditKind.fromValue(dbData);
    }
}
