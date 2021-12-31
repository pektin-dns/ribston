FROM denoland/deno:alpine
WORKDIR /oma/
# create the temp policy file
RUN touch policy.ts; chown deno:deno policy.ts
USER deno
# Cache deps
COPY deps.ts .
RUN deno cache deps.ts
# add code
ADD main.ts utils.ts ./
# compile main.ts
RUN deno cache main.ts
CMD ["run" ,"--allow-net", "--allow-run" ,"--allow-write=./policy.ts", "main.ts"]
