FROM denoland/deno:alpine
WORKDIR /ribston/
# create the temp policy file
RUN mkdir work; chown deno:deno work; mkdir watch; chown deno:deno watch
USER deno
# Cache deps
COPY deps.ts .
RUN deno cache deps.ts
# add code
ADD ./ ./
# compile main.ts
RUN deno cache main.ts
CMD ["run" ,"--allow-net", "--allow-run" ,"--allow-write=./work/,./watch/","--allow-read=./evaluator/Worker.js,./work/,./watch/", "main.ts"]
