# build images
"docker build -t your_img/your:version ."

# start
"docker run -d -p yourPort:8080 --name your_name images_id"

# logs
"docker logs -f your_container_id"

# stop
"docker stop your_container_id"