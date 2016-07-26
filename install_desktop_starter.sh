#/bin/bash
DIR=`dirname "$(readlink -f "$0")"`

mkdir -p ~/Desktop
cp ${DIR}/blue.desktop.in ~/Desktop/blue.desktop
sed -i "s#DESKTOPDIR#${DIR}#g" ~/Desktop/blue.desktop

echo "Created blue.desktop entry in ~/Desktop"

