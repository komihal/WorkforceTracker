if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/user/.gradle/caches/8.13/transforms/d1281acda1dc2f9dcc4848869aa5e192/transformed/hermes-android-0.80.2-debug/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/user/.gradle/caches/8.13/transforms/d1281acda1dc2f9dcc4848869aa5e192/transformed/hermes-android-0.80.2-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

