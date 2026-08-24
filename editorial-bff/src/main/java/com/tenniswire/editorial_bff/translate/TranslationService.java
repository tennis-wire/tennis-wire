package com.tenniswire.editorial_bff.translate;

import com.deepl.api.DeepLClient;
import com.deepl.api.DeepLException;
import com.deepl.api.TextResult;
import com.deepl.api.TextTranslationOptions;
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

    /**
     * Translates text using DeepL API with HTML tag handling enabled.
     *
     * <p>HTML tags are preserved during translation — essential because the editor
     * works with rich text (Tiptap produces HTML).
     */
    public TranslateResponse translate(TranslateRequest request) throws DeepLException, InterruptedException {

        TextTranslationOptions options = new TextTranslationOptions();
        options.setTagHandling("html");

        TextResult result = deepLClient.translateText(
                request.text(),
                request.sourceLang(), // null = auto-detect
                request.targetLang(),
                options);

        return new TranslateResponse(result.getText(), result.getDetectedSourceLanguage());
    }
}
