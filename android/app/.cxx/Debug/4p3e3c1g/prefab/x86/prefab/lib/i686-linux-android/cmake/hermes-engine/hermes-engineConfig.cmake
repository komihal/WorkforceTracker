if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/user/.gradle/caches/8.11.1/transforms/b4162c8440e7f69cee79f75aa2ee51c4/transformed/hermes-android-0.80.2-debug/prefab/modules/libhermes/libs/android.x86/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/user/.gradle/caches/8.11.1/transforms/b4162c8440e7f69cee79f75aa2ee51c4/transformed/hermes-android-0.80.2-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

