package com.tenniswire.aggregator_service.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Locale;

// The column holds the collector's lower-case words, held in by a CHECK
@Converter(autoApply = true)
public class ExtractionConverter implements AttributeConverter<Extraction, String> {

    @Override
    public String convertToDatabaseColumn(Extraction value) {
        return value == null ? null : value.code();
    }

    @Override
    public Extraction convertToEntityAttribute(String value) {
        return value == null ? null : Extraction.valueOf(value.toUpperCase(Locale.ROOT));
    }
}
