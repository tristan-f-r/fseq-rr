import { parse } from "jsr:@std/csv";
import * as path from "jsr:@std/path";
import { FRAME_MESSAGE } from "./messages.ts";
import { Logger } from "jsr:@deno-library/logger";
import { createFSEQHeader, writeFSEQHeader } from "./frame.ts";

const logger = new Logger();

const DEFAULT_FRAME_COUNT = 1000;

function executeProgram(programName: string): Deno.ChildProcess {
  const command = new Deno.Command(
    path.join(Deno.cwd(), "programs", programName),
    {
      stdin: "piped",
      stderr: "piped",
      stdout: "null",
    },
  );
  return command.spawn();
}

const programs = parse(await Deno.readTextFile("./programs/index.csv"), {
  columns: ["name", "frameCount"],
}).map(({ name, frameCount }) => ({
  name,
  frameCount: frameCount === "0" ? DEFAULT_FRAME_COUNT : parseInt(frameCount),
  child: executeProgram(name),
}));

logger.info(`Found ${programs.length} programs.`);

await Deno.remove("./sequences", { recursive: true });
await Deno.mkdir("./sequences", { recursive: true });

logger.info("Refreshing sequences...");

const FRAME_MS = 50;
const SEQUENCE_FRAME_COUNT = 20 * 10;
const PIXELS = 500;

async function createSequenceFile(): Promise<Deno.FsFile> {
  const header = createFSEQHeader(FRAME_MS, SEQUENCE_FRAME_COUNT, PIXELS);
  const file = await Deno.create(`./sequences/${new Date().getTime()}.fseq`);
  const writer = file.writable.getWriter();

  writeFSEQHeader(header, writer);

  writer.releaseLock();

  return file;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

let currentFrame = 0;
let currentSequenceFileWriter = (await createSequenceFile()).writable
  .getWriter();

async function readReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array> {
  const { value } = await reader.read();
  return value ?? new Uint8Array();
}

while (true) {
  for (const program of programs) {
    const writer = program.child.stdin.getWriter();
    const reader = program.child.stderr.getReader();

    for (let i = 0; i < program.frameCount; i++) {
      await sleep(25);
      // request and get frame
      await writer.write(FRAME_MESSAGE);
      const packet = await readReader(reader);
      if (packet.length !== 1500) {
        throw new Error("uh oh!");
      }

      currentSequenceFileWriter.write(packet);

      currentFrame++;

      if (currentFrame > SEQUENCE_FRAME_COUNT) {
        throw Error("uh oh!");
      } else if (currentFrame == SEQUENCE_FRAME_COUNT) {
        logger.debug("Creating new sequence file.");
        currentFrame = 0;
        currentSequenceFileWriter = (await createSequenceFile()).writable
          .getWriter();
      }
    }

    writer.releaseLock();
    reader.releaseLock();
  }
}
