FROM denoland/deno:alpine
WORKDIR /ribston/
# create the temp policy file
RUN touch policy.js; chown deno:deno policy.js
USER deno
# Cache deps
COPY deps.ts .
RUN deno cache deps.ts
# add code
ADD main.ts ./
# compile main.ts
RUN deno cache main.ts
CMD ["run" ,"--allow-net", "--allow-run" ,"--allow-write=./policy.js", "main.ts"]
