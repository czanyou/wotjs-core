BUILD_TYPE      ?= 'Release'
#BUILD_TYPE      ?= 'Debug'

## ------------------------------------------------------------

# build tjs
define make_build
	@mkdir -p build

	@echo ""
	@echo "= Building: build"
	@cmake --build build/${1} -- -j4

	@echo "--"
	@echo "-- Executable building done: './build/${1}/tjs'"
endef

# generate a build system
define make_build_system
	@mkdir -p build/${1}

	@echo ""
	@echo "= Generate a build system in: './build/'"
	@cmake -H. -Bbuild/${1} -DBOARD_TYPE=${1} -DCMAKE_BUILD_TYPE=${BUILD_TYPE}
endef

## ------------------------------------------------------------
## make

all: build

build:
	$(call make_build_system,local)
	$(call make_build,local)
	@echo "-- Executable: `build/local/tjs -v`"

local: build

clean:
	rm -rf build

test:

## ------------------------------------------------------------

.PHONY: all build clean help local test
