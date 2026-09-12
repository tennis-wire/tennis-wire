package com.tenniswire.discussion_service.entity.converter;

import com.tenniswire.discussion_service.entity.ReportResolution;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ReportResolutionConverter implements AttributeConverter<ReportResolution, String> {

    @Override
    public String convertToDatabaseColumn(ReportResolution attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public ReportResolution convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ReportResolution.fromValue(dbData);
    }
}
