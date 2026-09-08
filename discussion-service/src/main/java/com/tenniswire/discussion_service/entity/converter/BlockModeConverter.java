package com.tenniswire.discussion_service.entity.converter;

import com.tenniswire.discussion_service.entity.BlockMode;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class BlockModeConverter implements AttributeConverter<BlockMode, String> {

    @Override
    public String convertToDatabaseColumn(BlockMode attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public BlockMode convertToEntityAttribute(String dbData) {
        return dbData == null ? null : BlockMode.fromValue(dbData);
    }
}
