#/bin/bash
DIR=`dirname "$(readlink -f "$0")"`

cp ${DIR}/blue.desktop.in ${DIR}/blue.desktop
sed -i "s#DESKTOPDIR#${DIR}#g" ${DIR}/blue.desktop

sudo desktop-file-install --delete-original ${DIR}/blue.desktop 

echo "Installed blue.desktop entry"

