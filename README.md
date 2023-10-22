util to fetch prices of starlink terminals from starlink.com website

run locally (need chrome and all libs, see dockerfile):  
export CURRENCY_API_KEY=\*\*\*
npm ci  
npm run start

run in Docker:  
docker build . --tag getprices:latest --progress plain  
mkdir ./out  
docker run --rm -it --init --mount type=bind,source="$(pwd)"/out,target=/out -e "OUT_DIR=/out" -e "CURRENCY_API_KEY=\*\*\*" getprices
