FROM denoland/deno:alpine
WORKDIR /ribston/
# create the temp policy file
RUN mkdir work watch; chown deno:deno work watch;
USER deno
# Cache deps
COPY deps.ts .
RUN deno cache deps.ts
# add code
ADD ./ ./
# compile main.ts
RUN deno cache main.ts
CMD ["deno","run" ,"--allow-net", "--allow-run" ,"--allow-write=./work/,./watch/","--allow-read=./evaluator/Worker.js,./work/,./watch/", "main.ts"]
