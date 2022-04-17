FROM denoland/deno:1.20.6

ADD build /app
WORKDIR /app

RUN deno cache --unstable ts/programs/aggregator.ts

CMD [ \
  "deno", \
  "run", \
  "--unstable", \
  "-A", \
  "ts/programs/aggregator.ts" \
]
