#!/bin/sh

sudo mkdir -p /mnt/factory
sudo mkdir -p /mnt/data
sudo mkdir -p /mnt/data1
sudo mkdir -p /mnt/data2
sudo mkdir -p /system/tuya/cfgs

sudo chmod 777 /mnt/factory
sudo chmod -R 777 /system/tuya
cp product.json /mnt/factory/product.json


tpm set tuya.pid=