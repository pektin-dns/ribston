FROM denoland/deno:alpine
WORKDIR /oma/
RUN touch policy.ts; chown deno:deno policy.ts
USER deno
ADD main.ts utils.ts ./
RUN deno cache main.ts
CMD ["run" ,"--allow-net", "--allow-run" ,"--allow-write=./policy.ts", "main.ts"]
