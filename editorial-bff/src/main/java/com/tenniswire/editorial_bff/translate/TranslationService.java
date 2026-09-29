package com.tenniswire.editorial_bff.translate;

import com.deepl.api.DeepLClient;
import com.deepl.api.DeepLException;
import com.deepl.api.TextResult;
import com.tenniswire.editorial_bff.translate.dto.TranslateRequest;
import com.tenniswire.editorial_bff.translate.dto.TranslateResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnBean(DeepLClient.class)
public class TranslationService {

    private final DeepLClient deepLClient;

    public TranslationService(DeepLClient deepLClient) {
        this.deepLClient = deepLClient;
    }

    // The editor sends plain text, paragraphs split by blank lines. As HTML, DeepL would read a
    // < or & in it as markup and would be free to fold the line breaks.
    public TranslateResponse translate(TranslateRequest request) throws DeepLException, InterruptedException {

        TextResult result = deepLClient.translateText(
                request.text(),
                request.sourceLang(), // null = auto-detect
                request.targetLang());

        return new TranslateResponse(result.getText(), result.getDetectedSourceLanguage());
    }
}
