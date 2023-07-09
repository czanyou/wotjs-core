#!/bin/bash
DIRNAME="$( cd "$( dirname "$0" )" && pwd )"

SDK_DIR="$( dirname "${DIRNAME}" )"
echo "SDK_DIR: ${SDK_DIR}"

chmod 777 ${DIRNAME}/../bin/tjs

${SDK_DIR}/bin/tjs -v
${DIRNAME}/../bin/tjs tpm firmware install ${SDK_DIR}
