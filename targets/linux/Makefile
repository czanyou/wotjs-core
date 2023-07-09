#BUILD_TYPE     ?= 'Release'
BUILD_TYPE      ?= 'Debug'
BOARD_TYPE 		?= linux
PROJECT_ROOT 	?= ../..

all: build sdk

build:
	cmake -H${PROJECT_ROOT}/ -B${PROJECT_ROOT}/build/${BOARD_TYPE} -DBOARD_TYPE=${BOARD_TYPE} -DCMAKE_BUILD_TYPE=${BUILD_TYPE}
	cmake --build ${PROJECT_ROOT}/build/${BOARD_TYPE} -- -j4

sdk:
	rm -rf ${PROJECT_ROOT}/output/${BOARD_TYPE}/files
	${PROJECT_ROOT}/build/local/tjs build pack ${BOARD_TYPE} ${PROJECT_ROOT}/

clean:
	rm -rf ${PROJECT_ROOT}/output/${BOARD_TYPE}/files
	rm -rf ${PROJECT_ROOT}/build/${BOARD_TYPE}

