package com.tenniswire.editorial_bff.translate;

import com.deepl.api.DeepLClient;
import com.tenniswire.editorial_bff.translate.dto.TranslateRequest;
import com.tenniswire.editorial_bff.translate.dto.TranslateResponse;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/translate")
@ConditionalOnBean(DeepLClient.class)
public class TranslationController {

    private final TranslationService translationService;

    public TranslationController(TranslationService translationService) {
        this.translationService = translationService;
    }

    @PostMapping
    public ResponseEntity<TranslateResponse> translate(@Valid @RequestBody TranslateRequest request) throws Exception {
        TranslateResponse response = translationService.translate(request);
        return ResponseEntity.ok(response);
    }
}
