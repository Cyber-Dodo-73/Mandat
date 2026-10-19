package com.mandat.api.collection;

import com.mandat.api.collection.dto.CollectionDtos.CollectionResponse;
import com.mandat.api.collection.dto.CollectionDtos.CraftResponse;
import com.mandat.api.collection.dto.CollectionDtos.RecycleRequest;
import com.mandat.api.collection.dto.CollectionDtos.RecycleResponse;
import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/collection")
@Tag(name = "Collection")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @GetMapping
    @Operation(summary = "Owned cards, one entry per card and finish")
    public CollectionResponse collection(@AuthenticationPrincipal AuthenticatedUser user) {
        return collectionService.collection(user.id());
    }

    @PostMapping("/{cardId}/recycle")
    @Operation(summary = "Recycle duplicate copies into Influence (always keeps one copy of the finish)")
    public RecycleResponse recycle(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String cardId,
            @Valid @RequestBody RecycleRequest request) {
        return collectionService.recycle(user.id(), cardId, request.finish(), request.quantity());
    }

    @PostMapping("/{cardId}/craft")
    @Operation(summary = "Craft a missing card (standard finish) with Influence")
    public CraftResponse craft(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String cardId) {
        return collectionService.craft(user.id(), cardId);
    }
}
