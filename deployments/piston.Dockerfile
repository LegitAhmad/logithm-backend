# syntax=docker/dockerfile:1
ARG PISTON_BASE_IMAGE=ghcr.io/engineer-man/piston@sha256:2f66b7456189c4d713aa986d98eccd0b6ee16d26c7ec5f21b30e942756fd127a
FROM ${PISTON_BASE_IMAGE}

# Match the application request budget and flush complete sandbox stdin.
# The guarded patch fails the build when an upstream integration point changes.
COPY deployments/piston-patch.cjs /tmp/logithm-piston-patch.cjs
RUN node /tmp/logithm-piston-patch.cjs && rm /tmp/logithm-piston-patch.cjs
