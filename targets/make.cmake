###############################################################################
# Development board type
if (NOT BOARD_TYPE)
  set(BOARD_TYPE "local")
endif ()

###############################################################################
# OS build options

# Linux
if ("${CMAKE_SYSTEM_NAME}" MATCHES "Linux")
    set(LINUX ON)
endif()

###############################################################################
# echo settings

function(cmake_print_settings)

    message(STATUS "")
    message(STATUS "== Project Configuration:")
    message(STATUS ".. CMAKE_ANDROID_ARCH_ABI ...... [${CMAKE_ANDROID_ARCH_ABI}]")
    message(STATUS ".. CMAKE_BINARY_DIR ............ [${CMAKE_BINARY_DIR}]")
    message(STATUS ".. CMAKE_BUILD_TYPE ............ [${CMAKE_BUILD_TYPE}]") # `Debug`, `Release`
    message(STATUS ".. CMAKE_C_COMPILER ............ [${CMAKE_C_COMPILER}]")
    message(STATUS ".. CMAKE_C_COMPILER_TARGET ..... [${CMAKE_C_COMPILER_TARGET}]")
    message(STATUS ".. CMAKE_C_EXTENSIONS .......... [${CMAKE_C_EXTENSIONS}]")
    message(STATUS ".. CMAKE_C_FLAGS ............... [${CMAKE_C_FLAGS}]")
    message(STATUS ".. CMAKE_C_STANDARD ............ [${CMAKE_C_STANDARD}]")
    message(STATUS ".. CMAKE_C_STANDARD_REQUIRED ... [${CMAKE_C_STANDARD_REQUIRED}]")
    message(STATUS ".. CMAKE_C_VISIBILITY_PRESET ... [${CMAKE_C_VISIBILITY_PRESET}]")
    message(STATUS ".. CMAKE_CURRENT_SOURCE_DIR .... [${CMAKE_CURRENT_SOURCE_DIR}]")
    message(STATUS ".. CMAKE_CXX_COMPILER .......... [${CMAKE_CXX_COMPILER}]")
    message(STATUS ".. CMAKE_CXX_COMPILER_ID ....... [${CMAKE_CXX_COMPILER_ID}]")
    message(STATUS ".. CMAKE_CXX_COMPILER_TARGET ... [${CMAKE_CXX_COMPILER_TARGET}]")
    message(STATUS ".. CMAKE_CXX_FLAGS ............. [${CMAKE_CXX_FLAGS}]")
    message(STATUS ".. CMAKE_EXE_LINKER_FLAGS ...... [${CMAKE_EXE_LINKER_FLAGS}]")
    message(STATUS ".. CMAKE_GENERATOR ............. [${CMAKE_GENERATOR}]")
    message(STATUS ".. CMAKE_HOST_SYSTEM_NAME ...... [${CMAKE_HOST_SYSTEM_NAME}]")
    message(STATUS ".. CMAKE_HOST_SYSTEM_VERSION ... [${CMAKE_HOST_SYSTEM_VERSION}]")
    message(STATUS ".. CMAKE_MACOSX_RPATH .......... [${CMAKE_MACOSX_RPATH}]")
    message(STATUS ".. CMAKE_MAKE_PROGRAM .......... [${CMAKE_MAKE_PROGRAM}]") # `make`
    message(STATUS ".. CMAKE_SHARED_LINKER_FLAGS ... [${CMAKE_SHARED_LINKER_FLAGS}]")
    message(STATUS ".. CMAKE_SOURCE_DIR ............ [${CMAKE_SOURCE_DIR}]") # 工程的顶级目录
    message(STATUS ".. CMAKE_STAGING_PREFIX ........ [${CMAKE_STAGING_PREFIX}]")
    message(STATUS ".. CMAKE_SYSROOT ............... [${CMAKE_SYSROOT}]") # 系统根文件目录
    message(STATUS ".. CMAKE_SYSTEM_NAME ........... [${CMAKE_SYSTEM_NAME}]")
    message(STATUS ".. CMAKE_SYSTEM_PROCESSOR ...... [${CMAKE_SYSTEM_PROCESSOR}]")
    message(STATUS ".. CMAKE_SYSTEM_VERSION ........ [${CMAKE_SYSTEM_VERSION}]")
    message(STATUS ".. CMAKE_TOOLCHAIN_FILE ........ [${CMAKE_TOOLCHAIN_FILE}]")
    message(STATUS ".. CMAKE_VERBOSE_MAKEFILE ...... [${CMAKE_VERBOSE_MAKEFILE}]") # 是否输出详细的信息
    message(STATUS ".. CMAKE_VERSION ............... [${CMAKE_VERSION}]")
    # project
    message(STATUS ".. PROJECT_BINARY_DIR .......... [${PROJECT_BINARY_DIR}]")
    message(STATUS ".. PROJECT_NAME ................ [${PROJECT_NAME}]")
    message(STATUS ".. PROJECT_VERSION ............. [${PROJECT_VERSION}]")
    message(STATUS ".. PROJECT_VERSION_MAJOR ....... [${PROJECT_VERSION_MAJOR}]")
    message(STATUS ".. PROJECT_VERSION_MINOR ....... [${PROJECT_VERSION_MINOR}]")
    message(STATUS ".. PROJECT_VERSION_PATCH ....... [${PROJECT_VERSION_PATCH}]")
    message(STATUS ".. PROJECT_VERSION_TWEAK ....... [${PROJECT_VERSION_TWEAK}]")
    message(STATUS "==")

endfunction()

# Git
set(COMMIT_HASH "git_commit")
set(BRANCH_NAME "git_branch")

find_package(Git QUIET)
if (GIT_FOUND)
    execute_process(
        COMMAND ${GIT_EXECUTABLE} log -1 --pretty=format:%h
        OUTPUT_VARIABLE COMMIT_HASH
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )

    execute_process(
        COMMAND ${GIT_EXECUTABLE} symbolic-ref --short -q HEAD
        OUTPUT_VARIABLE BRANCH_NAME
        OUTPUT_STRIP_TRAILING_WHITESPACE
        ERROR_QUIET
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    )

    message(STATUS "Git version is ${GIT_EXECUTABLE}:${COMMIT_HASH}:${BRANCH_NAME}")
endif ()

###############################################################################
# Cross compiler options
# determine the parameters of the compiler toolchain through BOARD_TYPE

set(TJS_BOARD ${BOARD_TYPE})
include(targets/${BOARD_TYPE}/make.cmake)

link_directories(build/${BOARD_TYPE}/)
