BOARD_TYPE      ?= $(shell if [ -f build/board ]; then cat build/board; else echo 'local'; fi)
BOARDS 			= $(shell ls targets)

# make <target> BUILD_TYPE=Release|Debug
BUILD_TYPE      ?= 'Release'

# Colors
L ?= \033[30m
R ?= \033[31m
G ?= \033[32m
Y ?= \033[33m
B ?= \033[34m
P ?= \033[35m
C ?= \033[36m
W ?= \033[37m
N ?= \033[0m

ifneq (${board},)
	BOARD_TYPE = ${board}
endif

## ------------------------------------------------------------

# Generate a build system
define make_build_system
	@mkdir -p build
	@echo "= Save board type (${1}) in: './build/board'";
	@echo "${1}" > build/board;

	@echo ""
	@echo "= Generate a build system in: './build/${1}'"
	@cmake -H. -Bbuild/${1} -DBOARD_TYPE=${1} -DCMAKE_BUILD_TYPE=${BUILD_TYPE}
endef

# Building tjs
define make_build
	@mkdir -p build

	@echo ""
	@echo "= Building: build/${1}"
	@mkdir -p ./build/${1}/
	cmake --build ./build/${1} -- -j4

	@echo "--"
	@echo "-- Executable building done: './build/${1}/tjs'"
	@echo "--"
endef

# Print help info
define make_help
	@echo "Welcome to WoT.js build system."
	@echo ""
	@echo "$CUsage: make <TARGET|BOARD>$N"
	@echo ""
	@echo "Some useful targets:"
	@echo ""

	@echo "  $Gbuild$N     Build current project and all of its dependencies."
	@echo "  $Gclean$N     Clean the output of current project."
	@echo ""
	@echo "  $Gtest$N      Execute unit tests."
	@echo ""
	@echo "  $Glink$N      Symlinks the application to a folder for deployment to current hosting system."
	@echo "  $Gunlink$N    Remove all linked files"
	@echo ""

	@echo "Available board targets:"
	@echo ""
	@echo "$C" ${BOARDS} "$N"
	@echo ""

endef

## ------------------------------------------------------------

.PHONY: all board boards build clean config docs help link local pack test unlink

## ------------------------------------------------------------
## help

help:
	$(call make_help)

## ------------------------------------------------------------
## make

all: help

build:
	$(call make_build_system,${BOARD_TYPE})
	$(call make_build,${BOARD_TYPE})

clean:
	rm -rf ./build/*

test:
	@echo "$GExecuting unit tests...$N"
	./build/local/tjs test core/test/core core/test/ext core/test/native \
	core/test/http core/test/mqtt core/test/net core/test/tls

test2:
	./build/local/tjs test core/test/core core/test/ext core/test/native \
	core/test/http core/test/mqtt core/test/net core/test/tls

# 自动生成和更新项目版本号
version:
	@./build/local/tjs build version ./CMakeVersion.cmake

## ------------------------------------------------------------
## Link

link:
	@./build/local/tjs build link ${BOARD_TYPE}

unlink:
	@./build/local/tjs build unlink ${BOARD_TYPE}

## ------------------------------------------------------------
## Platforms or boards

board:
	$(if ${board}, $(call make_build_system,${board}))
	$(if ${board}, $(call make_build,${board}))

local:
	@make board board=$@ --no-print-directory
	@echo "-- Executable: `build/$@/tjs -v` BUILD_TYPE=${BUILD_TYPE}"

darwin:
	@make board board=$@ --no-print-directory

windows:
	@make board board=$@ --no-print-directory

linux:
	@make board board=$@ --no-print-directory
	@echo "-- Executable: `build/$@/tjs -v` BUILD_TYPE=${BUILD_TYPE}"

linux-arm:
	@make board board=$@ --no-print-directory

linux-arm64:
	rsync -av core/libs/aarch64/* build/$@/
	@make board board=$@ --no-print-directory

arm64: linux-arm64
arm: linux-arm
