PWD 			= $(shell pwd)
BOARD_TYPE      = 'local'
BOARDS 			= $(shell ls config)
BUILD_TYPE      ?= 'Release'
#BUILD_TYPE      ?= 'Debug'

## ------------------------------------------------------------

# build tjs
define make_build
	@mkdir -p build

	@echo ""
	@echo "= Building: build"
	@cmake --build build

	@echo "--"
	@echo "-- Executable building done: './build/tjs'"
endef

# generate a build system
define make_build_system
	@mkdir -p build

	@echo ""
	@echo "= Generate a build system in: './build/'"
	@cmake -H. -Bbuild/ -DBOARD_TYPE=local -DCMAKE_BUILD_TYPE=${BUILD_TYPE}
endef

## ------------------------------------------------------------

help:
	@echo ''
	@echo 'Welcome to WoT.js build system. Some useful make targets:'
	@echo "\033[32m"

	@echo ''
	@echo '  build     - Build `tjs` and other native modules'
	@echo '  clean     - Removes all build output files'
	@echo '  test      - Run unit test cases'

	@echo ''
	@echo "\033[0m"

	@echo "You can type 'make build' to build the native modules and then type 'make install' to install the WoT.js runtime."
	@echo ''


## ------------------------------------------------------------
## make

all: help

config:
	$(call make_build_system)

build: config
	$(call make_build)
	@echo ""
	@echo "-- Executable: `build/tjs -v`"

clean:
	rm -rf build

test:
	

## ------------------------------------------------------------

.PHONY: all build clean config docs help link test unlink
