cmake_minimum_required(VERSION 2.6)

# Test the target renaming support by adding a prefix to the targets built
set(MBEDTLS_TARGET_PREFIX subproject_test_)

# We use the parent Mbed TLS directory as the LIBMBEDTLS_DIR for this test. Other
# projects that use Mbed TLS as a subproject are likely to add by their own
# relative paths.
set(LIBMBEDTLS_DIR ../../../)

# Add Mbed TLS as a subdirectory.
add_subdirectory(${LIBMBEDTLS_DIR} build)

# Link against all the Mbed TLS libraries. Verifies that the targets have been
# created using the specified prefix
set(libs
    subproject_test_mbedcrypto
    subproject_test_mbedx509
    subproject_test_mbedtls
)

add_executable(cmake_subproject cmake_subproject.c)
target_link_libraries(cmake_subproject ${libs})
