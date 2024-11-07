cmake_minimum_required(VERSION 3.12)

###############################################################################
# Project version

include(CMakeVersion.cmake)
project(TJS VERSION ${TJS_PROJECT_VERSOIN})

include(CheckCCompilerFlag)
include(targets/make.cmake)

###############################################################################
# build sub directory

include(core/make.cmake)
include(modules/make.cmake)
include(app/make.cmake)

cmake_print_settings()
