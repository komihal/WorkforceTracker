if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/user/.gradle/caches/8.13/transforms/d9bb05e48da7270971004d464a8449e7/transformed/hermes-android-0.80.2-release/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/user/.gradle/caches/8.13/transforms/d9bb05e48da7270971004d464a8449e7/transformed/hermes-android-0.80.2-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

