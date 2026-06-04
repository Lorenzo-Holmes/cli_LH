FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

ARG VERSION=dev
ARG COMMIT=none
ARG BUILD_DATE=unknown

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w -X 'main.Version=${VERSION}' -X 'main.Commit=${COMMIT}' -X 'main.BuildDate=${BUILD_DATE}'" -o ./cli_LH ./cmd/server/

FROM alpine:3.23

RUN apk add --no-cache tzdata

RUN mkdir /cli_LH

COPY --from=builder ./app/cli_LH /cli_LH/cli_LH

COPY config.example.yaml /cli_LH/config.example.yaml

WORKDIR /cli_LH

EXPOSE 8317

ENV TZ=Asia/Shanghai

RUN cp /usr/share/zoneinfo/${TZ} /etc/localtime && echo "${TZ}" > /etc/timezone

CMD ["./cli_LH"]
