cmake_minimum_required(VERSION 3.12)

###############################################################################
# Project version

project(TJS VERSION 24.4.28.25)

include(CheckCCompilerFlag)
include(targets/common/make.cmake)

###############################################################################
# Cross compiler options
# determine the parameters of the compiler toolchain through BOARD_TYPE

set(TJS_BOARD ${BOARD_TYPE})
include(targets/${BOARD_TYPE}/make.cmake)

###############################################################################
# build sub directory

include(core/make.cmake)
include(modules/make.cmake)
include(packages/make.cmake)
include(app/make.cmake)

cmake_print_settings()
