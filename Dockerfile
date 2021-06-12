FROM python:2.7
RUN echo "Asia/Shanghai" > /etc/timezone

ADD . ./Curve
COPY start.sh ./Curve/start.sh
COPY profile /etc/profile

RUN chmod +x ./Curve/start.sh
EXPOSE 8080
ENTRYPOINT ["./Curve/start.sh"]
