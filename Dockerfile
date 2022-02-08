FROM denoland/deno:alpine
WORKDIR /ribston/
# create the temp policy file
RUN mkdir work; chown deno:deno work
USER deno
# Cache deps
COPY deps.ts .
RUN deno cache deps.ts
# add code
ADD ./ ./
# compile main.ts
RUN deno cache main.ts
CMD ["run" ,"--allow-net", "--allow-run" ,"--allow-read=./evaluator/Worker.js", "main.ts"]
