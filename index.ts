import { parse } from "jsr:@std/csv";
import { FRAME_MESSAGE } from "./lib/messages.ts";
import { Logger } from "jsr:@deno-library/logger";
import { createFSEQHeader, writeFSEQHeader } from "./lib/frame.ts";
import { FRAME_MS, PIXELS } from "./lib/constants.ts";
import { sleep } from "./lib/util.ts";
import { executeProgram, readReader } from "./lib/exec.ts";
import path from "node:path";

const logger = new Logger();

// if programs have an unspecified number of frames they want to run for
const DEFAULT_FRAME_COUNT = 1000;
// number of frames each .fseq file gets before sending: this is the FPS * 10 (10 seconds of frames)
const SEQUENCE_FRAME_COUNT = (1000 / FRAME_MS) * 10;

const programs = parse(await Deno.readTextFile("./programs/index.csv"), {
  columns: ["name", "frameCount"],
}).map(({ name, frameCount }) => ({
  name,
  frameCount: frameCount === "0" ? DEFAULT_FRAME_COUNT : parseInt(frameCount),
  child: executeProgram(path.join(Deno.cwd(), "programs", name)),
}));

logger.info(`Found ${programs.length} programs.`);

await Deno.stat("./sequences").then(() =>
  Deno.remove("./sequences", { recursive: true })
).catch((...args) => void args);
await Deno.mkdir("./sequences", { recursive: true });

logger.info("Refreshing sequences...");

interface SequenceFile {
  file: Deno.FsFile;
  path: string;
}

async function createSequenceFile(): Promise<SequenceFile> {
  const header = createFSEQHeader(FRAME_MS, SEQUENCE_FRAME_COUNT, PIXELS);
  const path = `./sequences/${new Date().getTime()}.fseq`;
  const file = await Deno.create(path);
  const writer = file.writable.getWriter();

  writeFSEQHeader(header, writer);

  writer.releaseLock();

  return { path, file };
}

async function onFileDone({ file, path }: SequenceFile) {
}

let currentFrame = 0;
let currentSequence = await createSequenceFile();
let currentSequenceFileWriter = currentSequence.file.writable.getWriter();

while (true) {
  program: for (const program of programs) {
    logger.info("Looking through program", program.name);
    const writer = program.child.stdin.getWriter();
    const reader = program.child.stderr.getReader();

    for (let i = 0; i < program.frameCount; i++) {
      await sleep(25);
      // request and get frame
      await writer.write(FRAME_MESSAGE);
      const packet = await readReader(reader);
      if (packet.length !== PIXELS * 3) {
        const decoder = new TextDecoder();
        logger.warn(
          `packet.length = ${packet.length} != ${
            PIXELS * 3
          }. Going to next program. Decoded packet :=${decoder.decode(packet)}`,
        );
        program.child.kill();
        program.child = executeProgram(program.name);
        continue program;
      }

      currentSequenceFileWriter.write(packet);

      currentFrame++;

      if (currentFrame > SEQUENCE_FRAME_COUNT) {
        // TODO: recovery from this?
        throw Error(
          `uh oh! ${SEQUENCE_FRAME_COUNT} < ${currentFrame}!! this shouldn't happen and is bad`,
        );
      } else if (currentFrame == SEQUENCE_FRAME_COUNT) {
        // teardown
        currentSequenceFileWriter.releaseLock();
        onFileDone(currentSequence);

        logger.debug("Creating new sequence file.");
        currentFrame = 0;
        currentSequence = await createSequenceFile();
        currentSequenceFileWriter = currentSequence.file.writable.getWriter();
      }
    }

    writer.releaseLock();
    reader.releaseLock();
  }
}
