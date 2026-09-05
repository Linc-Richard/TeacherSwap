# TeacherSwap deployment image for Railway.
# Railway auto-detects this Dockerfile and runs:
#   docker build -t teacherswap .
#   docker run  -p 3000:3000  (Railway provides PORT + DATA_DIR via env)
#
# The image contains BOTH the Express backend (server/) and the static
# frontend it serves, so nothing else needs to be deployed.

FROM node:20-slim

WORKDIR /app

# Install only runtime dependencies from server/<package-lock.json>.
# Keeps the image small; dev tooling (eslint) is not needed in production.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source. node_modules / .env / uploads are excluded by
# .dockerignore; secrets come from Railway env vars, never from the image.
COPY . .

# Railway injects a dynamic PORT at runtime — the app binds whatever the
# platform assigns, so no production port is assumed here.
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]