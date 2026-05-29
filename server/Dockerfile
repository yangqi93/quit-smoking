# ============================================================
# Stage 1: Build
# ============================================================
FROM golang:1.22-alpine AS builder

# Go 模块代理
ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /build

# 先复制依赖文件，充分利用 Docker 缓存
COPY go.mod go.sum ./
RUN go mod download

# 复制源码并编译
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server .

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM alpine:3.19

WORKDIR /app
COPY --from=builder /app/server .

EXPOSE 8080

CMD ["./server"]
